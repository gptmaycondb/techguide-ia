const fs = require('fs');
const path = require('path');

const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'biometrics.js'), 'utf8');
const appSource = fs.readFileSync(path.join(__dirname, '..', 'App.js'), 'utf8');
const gateSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'BiometricGate.js'), 'utf8');
const drawerSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'DrawerContent.js'), 'utf8');
const loginSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'LoginScreen.js'), 'utf8');
const authSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'auth.js'), 'utf8');
const chatSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'ChatScreen.js'), 'utf8');
let pass = 0;
let fail = 0;

function check(label, actual, expected) {
  const ok = actual === expected;
  console.log(`  [${ok ? '✓' : '✗ FAIL'}] ${label}`);
  if (ok) pass++;
  else {
    fail++;
    console.log(`    esperado=${JSON.stringify(expected)} recebido=${JSON.stringify(actual)}`);
  }
}

function extractFunction(name) {
  const start = source.search(new RegExp(`export function ${name}\\s*\\(`));
  if (start < 0) throw new Error(`Função ${name} não encontrada`);
  const functionStart = source.indexOf('function', start);
  const braceStart = source.indexOf('{', functionStart);
  let depth = 0;
  for (let i = braceStart; i < source.length; i++) {
    if (source[i] === '{') depth++;
    if (source[i] === '}') depth--;
    if (depth === 0) {
      return new Function(`return (${source.slice(functionStart, i + 1)})`)();
    }
  }
  throw new Error(`Fim da função ${name} não encontrado`);
}

const biometricStorageKey = extractFunction('biometricStorageKey');
const normalizeBiometricPreference = extractFunction('normalizeBiometricPreference');
const getBiometricBootState = extractFunction('getBiometricBootState');
const shouldOfferBiometric = extractFunction('shouldOfferBiometric');
const classifyBiometricVaultError = extractFunction('classifyBiometricVaultError');
const isStaleBiometricCredentialError = extractFunction('isStaleBiometricCredentialError');

console.log('\n[Biometria] política local e flag por usuário');
check('chave normaliza e-mail por usuário', biometricStorageKey(' User@Example.COM '), 'tg_biometric_user@example.com');
check('preferência on é válida', normalizeBiometricPreference('on'), 'on');
check('preferência off é válida', normalizeBiometricPreference('off'), 'off');
check('valor inesperado vira não-definida', normalizeBiometricPreference('yes'), undefined);
check('flag on + biometria disponível bloqueia', getBiometricBootState('user@example.com', 'on', true), 'locked');
check('flag off abre direto', getBiometricBootState('user@example.com', 'off', true), 'unlocked');
check('flag não-definida abre direto', getBiometricBootState('user@example.com', undefined, true), 'unlocked');
check('aparelho sem biometria abre direto', getBiometricBootState('user@example.com', 'on', false), 'unlocked');
check('oferta aparece apenas quando não definida', shouldOfferBiometric('user@example.com', undefined, true), true);
check('oferta não aparece sem biometria', shouldOfferBiometric('user@example.com', undefined, false), false);
check('oferta não reaparece após off', shouldOfferBiometric('user@example.com', 'off', true), false);
check('capacidade exige hardware e cadastro',
  source.includes('LocalAuthentication.hasHardwareAsync()')
    && source.includes('LocalAuthentication.isEnrolledAsync()'), true);
check('fallback do dispositivo está permitido',
  source.includes('disableDeviceFallback: false')
    && source.includes("biometricsSecurityLevel: 'weak'"), true);
check('storage biométrico grava somente on/off',
  source.includes("value !== 'on' && value !== 'off'"), true);
check('boot restaurado aplica o cadeado',
  appSource.includes('loadBiometricState(session.email, true)'), true);
check('login por senha não bloqueia a sessão recém-autenticada',
  appSource.includes('loadBiometricState(email, false)'), true);
check('cancelamento oferece tentar novamente e entrar com senha',
  gateSource.includes('Tentar novamente')
    && gateSource.includes('Entrar com senha')
    && appSource.includes('onPasswordLogin={handleLogout}'), true);
check('toggle fica oculto sem capacidade biométrica',
  drawerSource.includes('{biometricAvailable && ('), true);

console.log('\n[Login biométrico] cofre forte, fallback e ciclo de vida');
check('cancelamento do cofre não é invalidação',
  classifyBiometricVaultError(new Error('User canceled the authentication')), 'cancelled');
check('erro de Keystore é tratado como invalidação',
  classifyBiometricVaultError(new Error('Key permanently invalidated')), 'invalidated');
check('login por senha limpa o cofre anterior antes de recriar',
  appSource.includes("if (loginMeta.method === 'password') {\n        await clearBiometricCredentials();"), true);
check('senha rejeitada invalida credencial salva',
  isStaleBiometricCredentialError({ code: 'invalid_credentials' }), true);
check('erro de rede preserva credencial salva',
  isStaleBiometricCredentialError({ code: 'network_error' }), false);
check('credenciais usam SecureStore com autenticação forte',
  source.includes('SecureStore.setItemAsync(')
    && source.includes('requireAuthentication: true')
    && source.includes('SecureStore.canUseBiometricAuthentication()'), true);
check('email existe apenas dentro do item protegido, marcador é booleano',
  source.includes("BIOMETRIC_MARKER_KEY = 'biometric_login_available'")
    && source.includes("BIOMETRIC_MARKER_KEY,\n      '1'")
    && !source.includes('biometric_login_owner'), true);
check('cópia legada da senha é removida após gravar o cofre',
  authSource.includes('export async function clearSavedPasswordFallback()')
    && appSource.match(/await clearSavedPasswordFallback\(\)/g)?.length === 3, true);
check('senha não é gravada no AsyncStorage',
  !/AsyncStorage\.setItem\([^)]*(?:password|senha)/i.test(source + appSource + loginSource), true);
check('senha não é enviada para logs',
  !/console\.(?:log|warn|error)\([^)]*(?:password|senha)/i.test(source + appSource + loginSource + authSource), true);
check('botão aparece somente com marcador de cofre',
  loginSource.includes('hasBiometricCredentials()')
    && loginSource.includes('{biometricLoginAvailable && ('), true);
check('cancelar leitura mantém login por senha',
  loginSource.includes("if (vault.status === 'cancelled') return"), true);
check('invalidação limpa cofre e orienta nova ativação',
  loginSource.includes('Biometria alterada no aparelho')
    && source.includes("if (status === 'invalidated') await clearBiometricCredentials()"), true);
check('senha desatualizada limpa cofre e orienta nova senha',
  loginSource.includes('Senha alterada — entre com a nova senha.')
    && loginSource.includes('await clearBiometricCredentials()'), true);
check('logout não apaga as chaves do cofre biométrico',
  !authSource.includes('biometric_login_credentials')
    && !authSource.includes('clearBiometricCredentials'), true);
check('desativar toggle apaga flag e cofre',
  appSource.includes("setBiometricPreference(authEmail, 'off')")
    && appSource.includes('clearBiometricCredentials()'), true);
check('toggle pede e valida senha antes de ativar',
  drawerSource.includes('Confirme sua senha')
    && appSource.includes('await verifyPassword(authEmail, password)'), true);
check('oferta e login com flag on gravam ou atualizam o cofre',
  appSource.includes('saveBiometricCredentials(email, password)')
    && appSource.includes("biometricState.preference === 'on'"), true);
check('401 desloga e retorna ao login',
  chatSource.includes('onAuthRequired();')
    && appSource.includes('onAuthRequired={handleLogout}'), true);

console.log(`\n=== ${pass + fail} testes: ${pass} passaram, ${fail} falharam ===`);
process.exit(fail > 0 ? 1 : 0);
