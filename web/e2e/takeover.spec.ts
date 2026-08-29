import { expect, test, type Page } from '@playwright/test'

/**
 * Fluxo de takeover ponta a ponta em Chromium real, com captura de tela falsa.
 * Exige a pilha completa no ar: SFU LiveKit + token-service + `npm run dev`.
 * Os textos batem com a UI atual (Home / ModalApelido / SeletorPerfil /
 * PedidoDeVez / Sala). Se um seletor quebrar, ajuste o TESTE, nunca a UI.
 */

async function entrarNaSala(page: Page, apelido: string): Promise<void> {
  await page.getByPlaceholder('Seu apelido').fill(apelido)
  await page.getByRole('button', { name: 'Entrar' }).click()
  // SeletorPerfil só aparece depois de conectar à sala.
  await expect(page.getByText('O que você vai mostrar?')).toBeVisible()
}

async function compartilhar(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Compartilhar minha tela' }).click()
}

test('a vez passa de Ana para Pedro quando Ana cede', async ({ browser }) => {
  const ctxAna = await browser.newContext()
  const ctxPedro = await browser.newContext()
  const ana = await ctxAna.newPage()
  const pedro = await ctxPedro.newPage()

  // Ana cria a sala e entra.
  await ana.goto('/')
  await ana.getByRole('button', { name: 'Criar sala' }).click()
  await ana.waitForURL(/\/sala\/[0-9a-f-]+/i)
  await entrarNaSala(ana, 'Ana')

  // Pedro entra na mesma sala.
  const urlSala = ana.url()
  await pedro.goto(urlSala)
  await entrarNaSala(pedro, 'Pedro')

  // Ana escolhe o perfil "Vídeo" e começa a compartilhar.
  await ana.getByRole('button', { name: /Vídeo/ }).click()
  await compartilhar(ana)
  await expect(
    ana.getByRole('button', { name: 'Parar de compartilhar' }),
  ).toBeVisible()

  // Pedro passa a ver a transmissão de Ana.
  await expect(pedro.locator('video')).toBeVisible()
  await expect(
    pedro.getByText('Ninguém está compartilhando agora'),
  ).toBeHidden()

  // Pedro pede a vez; Ana vê o pedido.
  await compartilhar(pedro)
  await expect(
    ana.getByText('Pedro quer compartilhar a tela.'),
  ).toBeVisible()

  // Ana cede. A vez e a transmissão passam para Pedro.
  await ana.getByRole('button', { name: 'Ceder' }).click()
  await expect(
    pedro.getByRole('button', { name: 'Parar de compartilhar' }),
  ).toBeVisible()
  await expect(ana.getByText('O que você vai mostrar?')).toBeVisible()
  await expect(ana.locator('video')).toBeVisible()
  await expect(
    ana.getByText('Ninguém está compartilhando agora'),
  ).toBeHidden()

  await ctxAna.close()
  await ctxPedro.close()
})
