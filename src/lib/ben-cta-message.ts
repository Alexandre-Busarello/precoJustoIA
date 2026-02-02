/**
 * Gera mensagens CTA do Ben para conversão de usuários gratuitos
 */

/**
 * Gera mensagem CTA como se o Ben estivesse falando
 * Usado quando usuário atinge limite de mensagens gratuitas
 */
export function generateBenCTAMessage(remaining: number = 0): string {
  return `Olá! Você já utilizou suas ${remaining === 0 ? '2 mensagens gratuitas' : `${2 - remaining} de 2 mensagens gratuitas`} de hoje. 

Para continuar conversando comigo e ter acesso a análises ilimitadas, projeções detalhadas do IBOVESPA e muito mais, considere fazer upgrade para Premium. 

Posso ajudar muito mais quando você tiver acesso completo! 🚀

[Fazer Upgrade para Premium](/checkout)`
}



