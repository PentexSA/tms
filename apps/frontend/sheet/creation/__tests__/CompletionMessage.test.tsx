import { render, screen } from '@testing-library/react-native'

import { CompletionMessage } from '../CompletionMessage'

// T-32: o corpo das confirmações, com as linhas extras que o P05-C usa (T-18)
it('mostra o corpo, o complemento e cada linha extra', () => {
  render(
    <CompletionMessage
      body="A ficha entra em jogo."
      suffix=" As alterações abaixo são salvas antes."
      notes={['Sobram 3 pontos de bônus.']}
    />
  )
  expect(
    screen.getByText(
      'A ficha entra em jogo. As alterações abaixo são salvas antes.'
    )
  ).toBeTruthy()
  expect(screen.getByText('Sobram 3 pontos de bônus.')).toBeTruthy()
})
