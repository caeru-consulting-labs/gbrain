const { chromium } = require('playwright');
const assert = require('node:assert/strict');
(async () => {
 const browser = await chromium.launch({headless:true,executablePath:'/usr/bin/google-chrome',args:['--no-sandbox']});
 try {
  const page = await browser.newPage({viewport:{width:1280,height:900}});
  await page.goto('http://127.0.0.1:4173/');
  await page.getByRole('button',{name:'Explorar demonstração'}).click();
  await page.getByRole('button',{name:'Conhecimento',exact:true}).first().click();
  await page.getByRole('button',{name:'Adicionar conhecimento',exact:true}).click({timeout:3000});
  for (const name of ['Criar memória manualmente','Enviar documentos','Importar uma URL','Importar conversas','Conectar fontes externas']) await page.getByRole('button',{name:new RegExp(name)}).waitFor();
  await page.getByRole('button',{name:/Enviar documentos/}).click();
  await page.locator('input[type=file]').setInputFiles([{name:'notas.md',mimeType:'text/markdown',buffer:Buffer.from('texto')},{name:'dados.pdf',mimeType:'application/pdf',buffer:Buffer.from('pdf')}]);
  await page.getByText('notas.md').waitFor(); await page.getByText('dados.pdf').waitFor();
  assert.equal(await page.locator('.document-item').getByText('Aguardando envio',{exact:true}).count(),2);
  await page.getByLabel('Projeto').selectOption('Operações');
  await page.getByLabel('Visibilidade').selectOption('restrito');
  assert.equal(await page.getByLabel('Projeto').inputValue(),'Operações');
  assert.equal(await page.getByLabel('Visibilidade').inputValue(),'restrito');
  await page.getByText('Nenhum arquivo foi enviado ou indexado.',{exact:false}).waitFor();
  await page.getByRole('button',{name:'Remover notas.md'}).click();
  assert.equal(await page.getByText('notas.md').count(),0);
  const transfer = await page.evaluateHandle(() => {const dt = new DataTransfer(); dt.items.add(new File(['abc'],'arrastado.txt',{type:'text/plain'})); return dt;});
  await page.locator('.dropzone').dispatchEvent('drop',{dataTransfer:transfer});
  await page.getByText('arrastado.txt').waitFor();
  await page.getByRole('button',{name:'Voltar às opções'}).click();
  await page.getByRole('button',{name:/Criar memória manualmente/}).click();
  await page.getByLabel('Título').fill('Aprendizado de exemplo');
  await page.getByLabel('Conteúdo').fill('Texto local');
  await page.getByRole('button',{name:'Criar exemplo'}).click();
  await page.getByText('Aprendizado de exemplo').first().waitFor();
  await page.getByRole('button',{name:'Adicionar conhecimento',exact:true}).click();
  await page.getByRole('button',{name:/Enviar documentos/}).click();
  await page.setViewportSize({width:390,height:844});
  await page.getByRole('heading',{name:'Enviar documentos'}).waitFor();
  console.log('knowledge preview: OK');
 } finally {await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
