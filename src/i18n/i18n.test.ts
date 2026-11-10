import { describe, it, expect } from 'vitest'
import {
  translate,
  interpolate,
  isLang,
  localeMeta,
  statusLabel,
  categoryLabel,
  complexityLabel,
  planLabel,
  LOCALES,
  DEFAULT_LANG,
  type Lang,
} from './index'
import pt from './pt'
import en from './en'
import es from './es'

describe('interpolate', () => {
  it('substitui placeholders {chave}', () => {
    expect(interpolate('Olá {name}, você tem {count} pedidos', { name: 'Ana', count: 3 }))
      .toBe('Olá Ana, você tem 3 pedidos')
  })
  it('mantém placeholders desconhecidos', () => {
    expect(interpolate('Valor {a} e {b}', { a: 1 })).toBe('Valor 1 e {b}')
  })
  it('sem params devolve o template intacto', () => {
    expect(interpolate('Sem {x}')).toBe('Sem {x}')
  })
})

describe('translate', () => {
  it('traduz a mesma chave em cada idioma', () => {
    expect(translate('pt-BR', 'nav.entrar')).toBe('Entrar')
    expect(translate('en', 'nav.entrar')).toBe('Sign in')
    expect(translate('es', 'nav.entrar')).toBe('Entrar')
  })
  it('interpola parametros na traducao', () => {
    expect(translate('en', 'client.sendToN', { count: 7 })).toBe('Send to 7 professionals')
    expect(translate('es', 'client.sendToN', { count: 7 })).toBe('Enviar a 7 profesionales')
  })
  it('faz fallback para o portugues quando o idioma nao tem catalogo', () => {
    // Idioma sem catalogo exercita de fato o ramo de fallback (os tres
    // catalogos reais tem as mesmas chaves, entao nao serviriam).
    expect(translate('xx' as unknown as Lang, 'nav.entrar')).toBe('Entrar')
  })
  it('devolve a propria chave quando nao existe em nenhum idioma', () => {
    expect(translate('en', 'chave.que.nao.existe')).toBe('chave.que.nao.existe')
  })
})

describe('isLang', () => {
  it('aceita apenas os codigos suportados', () => {
    expect(isLang('pt-BR')).toBe(true)
    expect(isLang('en')).toBe(true)
    expect(isLang('es')).toBe(true)
    expect(isLang('fr')).toBe(false)
    expect(isLang(null)).toBe(false)
    expect(isLang(42)).toBe(false)
  })
})

describe('localeMeta', () => {
  it('devolve os metadados do idioma', () => {
    expect(localeMeta('en').htmlLang).toBe('en')
    expect(localeMeta('es').label).toBe('Español')
  })
  it('cai para o primeiro locale para um idioma desconhecido', () => {
    expect(localeMeta('fr' as Lang)).toBe(LOCALES[0])
  })
  it('expõe os tres idiomas suportados', () => {
    expect(LOCALES.map((l) => l.code)).toEqual(['pt-BR', 'en', 'es'])
    expect(DEFAULT_LANG).toBe('pt-BR')
  })
})

describe('rotulos de valores gravados no banco', () => {
  it('traduz status sem alterar o valor original', () => {
    expect(statusLabel('pt-BR', 'Visita Agendada')).toBe('Visita Agendada')
    expect(statusLabel('en', 'Visita Agendada')).toBe('Visit scheduled')
    expect(statusLabel('es', 'Visita Agendada')).toBe('Visita agendada')
    expect(statusLabel('en', 'Concluído')).toBe('Completed')
  })
  it('devolve o valor original para status desconhecido', () => {
    expect(statusLabel('en', 'Status Novo')).toBe('Status Novo')
  })
  it('traduz categorias', () => {
    expect(categoryLabel('en', 'Eletricista')).toBe('Electrician')
    expect(categoryLabel('es', 'Encanador')).toBe('Plomero')
    expect(categoryLabel('en', 'Categoria Inventada')).toBe('Categoria Inventada')
  })
  it('traduz as categorias Piscineiro e Serviços de Cartório nos três idiomas', () => {
    expect(categoryLabel('pt-BR', 'Piscineiro')).toBe('Piscineiro')
    expect(categoryLabel('en', 'Piscineiro')).toBe('Pool maintenance')
    expect(categoryLabel('es', 'Piscineiro')).toBe('Piscinero')
    expect(categoryLabel('pt-BR', 'Serviços de Cartório')).toBe('Serviços de Cartório')
    expect(categoryLabel('en', 'Serviços de Cartório')).toBe('Notary services')
    expect(categoryLabel('es', 'Serviços de Cartório')).toBe('Notaría')
  })
  it('traduz a complexidade da IA', () => {
    expect(complexityLabel('en', 'Média')).toBe('Medium')
    expect(complexityLabel('es', 'Alta')).toBe('Alta')
    expect(complexityLabel('en', 'Baixa')).toBe('Low')
  })
  it('traduz planos mantendo os nomes de marca', () => {
    expect(planLabel('en', 'gratuito')).toBe('Free')
    expect(planLabel('en', 'ouro')).toBe('Premium')
    expect(planLabel('es', 'prata')).toBe('Plata')
    expect(planLabel('en', 'plano_x')).toBe('plano_x')
  })
})

type LeafKind = 'string' | 'object'

function collectPaths(tree: unknown, prefix = ''): Map<string, LeafKind> {
  const paths = new Map<string, LeafKind>()
  const kind: LeafKind = typeof tree === 'string' ? 'string' : 'object'
  if (prefix) paths.set(prefix, kind)
  if (kind === 'object' && tree && typeof tree === 'object' && !Array.isArray(tree)) {
    for (const [key, value] of Object.entries(tree)) {
      const childPrefix = prefix ? `${prefix}.${key}` : key
      for (const [path, childKind] of collectPaths(value, childPrefix)) paths.set(path, childKind)
    }
  }
  return paths
}

describe('paridade de chaves entre catalogos', () => {
  const ptPaths = collectPaths(pt)
  const enPaths = collectPaths(en)
  const esPaths = collectPaths(es)

  function diff(candidate: Map<string, LeafKind>) {
    return {
      missing: [...ptPaths.keys()].filter((path) => !candidate.has(path)),
      extra: [...candidate.keys()].filter((path) => !ptPaths.has(path)),
    }
  }

  it('en tem exatamente as mesmas chaves que pt', () => {
    expect(diff(enPaths)).toEqual({ missing: [], extra: [] })
  })

  it('es tem exatamente as mesmas chaves que pt', () => {
    expect(diff(esPaths)).toEqual({ missing: [], extra: [] })
  })

  it('tipos das folhas (string vs object) batem nos tres catalogos', () => {
    for (const [path, kind] of ptPaths) {
      expect(enPaths.get(path), `en:${path}`).toBe(kind)
      expect(esPaths.get(path), `es:${path}`).toBe(kind)
    }
  })
})
