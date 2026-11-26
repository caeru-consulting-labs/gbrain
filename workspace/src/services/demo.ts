export type Page = 'home' | 'chat' | 'memories' | 'projects' | 'integrations' | 'settings' | 'organization';
export type Memory = { id:string; title:string; description:string; category:string; project:string; updated:string; body:string; tags:string[] };
// Visual demonstration only. These records are never sent to GBrain.
export const initialMemories: Memory[] = [
 {id:'1',title:'Nossa visão de conhecimento',description:'Como transformamos aprendizados em conhecimento compartilhado.',category:'Cultura',project:'Caeru',updated:'Hoje',tags:['Conhecimento','Cultura'],body:'O conhecimento cresce quando é compartilhado. Este é um exemplo visual de como uma memória pode reunir contexto, decisões e aprendizados para toda a equipe.'},
 {id:'2',title:'Guia de descoberta de clientes',description:'Perguntas e práticas para entender o contexto de cada projeto.',category:'Metodologia',project:'Operações',updated:'Ontem',tags:['Discovery','Clientes'],body:'Uma boa descoberta começa pela compreensão do contexto, dos objetivos e dos desafios. Use este espaço para registrar evidências e próximos passos.'},
 {id:'3',title:'Rituais de acompanhamento',description:'Uma referência para conversas, alinhamentos e evolução contínua.',category:'Processos',project:'Operações',updated:'Há 3 dias',tags:['Rituais','Equipe'],body:'Registre aqui os rituais que ajudam a equipe a acompanhar decisões e transformar aprendizados em ação.'},
 {id:'4',title:'Princípios de trabalho',description:'As ideias que orientam a forma como trabalhamos juntos.',category:'Cultura',project:'Caeru',updated:'Há 5 dias',tags:['Equipe'],body:'Um espaço para compartilhar os princípios que orientam o trabalho da equipe.'},
];
export const demoProjects = [{name:'Caeru', description:'Conhecimento, cultura e referências da equipe.',count:2, color:'blue'}, {name:'Operações',description:'Processos e aprendizados para fazer acontecer.',count:2,color:'violet'}];
export const navigation: {id:Page; label:string}[] = [{id:'home',label:'Início'},{id:'chat',label:'Conversas'},{id:'memories',label:'Conhecimento'},{id:'projects',label:'Projetos'},{id:'integrations',label:'Integrações'}];
