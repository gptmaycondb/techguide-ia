export const ONBOARDING_STEPS = [
  {
    tab: 'chat', target: 'equipment',
    text: 'Primeiro, escolha o equipamento que voce esta atendendo. Toque aqui em Trocar pra mudar de impressora a qualquer momento.',
  },
  {
    tab: 'chat', target: 'search',
    text: 'Aqui é o principal: digite o código de erro ou descreva o problema. Eu busco direto nos manuais.',
  },
  {
    tab: 'favorites', target: 'favoritesTab',
    text: 'Aqui ficam seus favoritos. Marque a estrela em equipamentos, manuais ou codigos que voce usa muito, e eles aparecem aqui pra acesso rapido.',
  },
  {
    tab: 'manuals', target: 'manualsTab',
    text: 'Nesta aba ficam os manuais completos. Baixe pra consultar offline.',
  },
  {
    tab: 'manuals', target: 'bubble',
    text: 'Eu sou seu Assistente! Toque em mim pra ver dicas do equipamento. Pra me fechar, arraste até o X aqui embaixo — e pra me trazer de volta, é só abrir pelo menu.',
  },
];

export const onboardingStorageKey = email => `tg_onboarding_done_${email}`;

export function getOnboardingStep(index) {
  return Number.isInteger(index) && index >= 0 && index < ONBOARDING_STEPS.length
    ? ONBOARDING_STEPS[index]
    : null;
}
