const fs = require('fs');
const path = require('path');

const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'biometrics.js'), 'utf8');
const appSource = fs.readFileSync(path.join(__dirname, '..', 'App.js'), 'utf8');
const gateSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'BiometricGate.js'), 'utf8');
const drawerSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'DrawerContent.js'), 'utf8');
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
check('nenhuma senha ou credencial é persistida pela biometria',
  !/password|senha|credential|SecureStore/i.test(source), true);

console.log(`\n=== ${pass + fail} testes: ${pass} passaram, ${fail} falharam ===`);
process.exit(fail > 0 ? 1 : 0);
