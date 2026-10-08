import {
  CAROUSEL_BASE_CSS,
  CAROUSEL_IDENTITIES,
} from '@gitroom/nestjs-libraries/carousels/carousel.styles';

export type CarouselSlideType =
  | 'capa'
  | 'texto'
  | 'lista'
  | 'numero'
  | 'colunas'
  | 'citacao'
  | 'salvar'
  | 'fechamento';

export interface CarouselColumn {
  titulo: string;
  itens: string[];
}

// One slide as written by the AI, every field the type does not use is null
export interface CarouselSlide {
  type: CarouselSlideType;
  fundo: 'claro' | 'escuro' | 'cor';
  rotulo: string | null;
  titulo: string;
  destaque: string | null;
  subtitulo: string | null;
  itens: string[] | null;
  numero: string | null;
  colunaA: CarouselColumn | null;
  colunaB: CarouselColumn | null;
  citacao: string | null;
  autor: string | null;
  fonte: string | null;
  foto: string | null;
}

export interface CarouselBrand {
  identity: string;
  name: string;
  handle: string;
  bio: string;
  category: string;
  avatarPath?: string | null;
  photos: Array<{ path: string; emotion: string; cutout: boolean }>;
}

const escape = (value: string | null | undefined) =>
  (value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

// Wraps the highlighted words of the title, they must be part of it
const highlight = (title: string, words: string | null) => {
  const safe = escape(title);
  const target = escape(words || '').trim();
  if (!target) return safe;
  const index = safe.toLowerCase().indexOf(target.toLowerCase());
  if (index === -1) return safe;
  return (
    safe.slice(0, index) +
    `<span class="destaque">${safe.slice(index, index + target.length)}</span>` +
    safe.slice(index + target.length)
  );
};

const list = (items: string[] | null, className = 'lista') =>
  items?.length
    ? `<ul class="${className}">${items
        .map((item) => `<li>${escape(item)}</li>`)
        .join('')}</ul>`
    : '';

// The photo whose emotion matches what the AI asked for, any photo otherwise
const pickPhoto = (brand: CarouselBrand, emotion: string | null, index: number) => {
  if (!brand.photos.length || !emotion || emotion === 'nenhuma') return null;
  const wanted = emotion.toLowerCase();
  return (
    brand.photos.find((p) => p.emotion.toLowerCase() === wanted) ||
    brand.photos.find((p) => p.emotion.toLowerCase().includes(wanted)) ||
    brand.photos[index % brand.photos.length]
  );
};

export const buildCarouselHtml = (
  slides: CarouselSlide[],
  brand: CarouselBrand,
  date: string
) => {
  const total = String(slides.length).padStart(2, '0');
  const avatar = brand.avatarPath
    ? `<div class="avatar com-imagem" style="background-image:url('${escape(
        brand.avatarPath
      )}')"></div>`
    : `<div class="avatar">${escape(brand.name.charAt(0).toUpperCase())}</div>`;
  const footer = (page: string) => `
    <div class="rodape">
      <div class="assinatura">${avatar}<div><div class="nome">${escape(
        brand.name
      )}</div><div class="arroba">${escape(brand.handle)}</div></div></div>
      <span class="pagina">${page}</span>
    </div>`;

  const sections = slides.map((slide, index) => {
    const page = `${String(index + 1).padStart(2, '0')} / ${total}`;
    const photo = pickPhoto(brand, slide.foto, index);
    const label = slide.rotulo
      ? `<span class="rotulo">${escape(slide.rotulo)}</span>`
      : '';
    const source = slide.fonte
      ? `<p class="fonte">${escape(slide.fonte)}</p>`
      : '';
    const title = (size: string) =>
      `<h2 class="titulo ${size}">${highlight(slide.titulo, slide.destaque)}</h2>`;

    if (slide.type === 'capa') {
      const coverPhoto = photo
        ? photo.cutout
          ? `<div class="capa-foto foto"><div class="circulo"></div><img src="${escape(photo.path)}" alt=""></div>`
          : `<div class="capa-foto moldura foto"><img src="${escape(photo.path)}" alt=""></div>`
        : '';
      return `
<section class="slide claro pontos capa">
  <div class="topo"><span>${escape(brand.name)}</span><span>${escape(
        brand.category
      )}</span><span>${escape(date)}</span></div>
  <div class="capa-texto"${photo ? '' : ' style="max-width:920px"'}>
    ${slide.rotulo ? `<span class="selo">${escape(slide.rotulo)}</span>` : ''}
    <h1 class="titulo">${highlight(slide.titulo, slide.destaque)}</h1>
    ${slide.subtitulo ? `<p class="sub${photo ? ' estreita' : ''}">${escape(slide.subtitulo)}</p>` : ''}
  </div>
  ${coverPhoto}
  ${footer(page)}
</section>`;
    }

    let body = '';
    let size = 'medio';
    switch (slide.type) {
      case 'lista':
        body = `${label}${title('medio')}${list(slide.itens)}${source}`;
        break;
      case 'numero':
        size = 'pequeno';
        body = `${label}${title('pequeno')}<div class="numero">${escape(
          slide.numero
        )}</div>${
          slide.subtitulo ? `<p class="texto">${escape(slide.subtitulo)}</p>` : ''
        }${source}`;
        break;
      case 'colunas':
        body = `${label}${title('medio')}<div class="colunas">${[
          slide.colunaA,
          slide.colunaB,
        ]
          .map(
            (column, i) =>
              `<div class="coluna${i === 1 ? ' marcada' : ''}"><h3>${escape(
                column?.titulo
              )}</h3>${list(column?.itens || [])}</div>`
          )
          .join('')}</div>${source}`;
        break;
      case 'citacao':
        body = `${label}<div class="aspas">“</div><p class="citacao pequena">${escape(
          slide.citacao || slide.titulo
        )}</p>${
          slide.autor ? `<p class="autor-citacao">${escape(slide.autor)}</p>` : ''
        }${source}`;
        break;
      case 'salvar':
        body = `${label || '<span class="rotulo">Salve este slide</span>'}${title(
          'medio'
        )}${list(slide.itens, 'checklist compacta')}${source}`;
        break;
      case 'fechamento':
        body = `<div class="quadrado"></div>${title('')}${
          slide.subtitulo ? `<p class="texto">${escape(slide.subtitulo)}</p>` : ''
        }<div class="cartao-siga">${avatar}<div><div class="chamada">Siga ${escape(
          brand.handle
        )}</div><div class="bio">${escape(brand.bio)}</div></div></div>`;
        break;
      default:
        body = `${label}${title(size)}${
          slide.subtitulo ? `<p class="texto">${escape(slide.subtitulo)}</p>` : ''
        }${list(slide.itens)}${source}`;
    }

    // colunas need the full width, every other slide can take a photo
    const cornerPhoto =
      photo && slide.type !== 'colunas'
        ? `<img class="foto-canto foto${photo.cutout ? '' : ' moldura'}" src="${escape(
            photo.path
          )}" alt="">`
        : '';

    return `
<section class="slide ${slide.fundo} pontos${cornerPhoto ? ' com-foto' : ''}">
  <div class="topo"><span>${escape(brand.name)}</span><span>${escape(
      brand.category
    )}</span><span>${page}</span></div>
  <div class="conteudo">${body}</div>
  ${cornerPhoto}
  ${footer(page)}
</section>`;
  });

  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<style>${CAROUSEL_IDENTITIES[brand.identity] || CAROUSEL_IDENTITIES.editorial}</style>
<style>${CAROUSEL_BASE_CSS}</style>
</head>
<body class="um-slide">
${sections.join('\n')}
</body>
</html>`;
};

// Runs in the page before each screenshot (Passo 9 of the guide): shrinks the
// text block until no line leaks into the footer or under the photo
export const FIT_SLIDE_SCRIPT = `(index) => {
  const slides = Array.from(document.querySelectorAll('.slide'));
  slides.forEach((s, i) => s.classList.toggle('ativo', i === index));
  const slide = slides[index];
  const block = slide.querySelector('.conteudo, .capa-texto');
  const footer = slide.querySelector('.rodape');
  const obstacle = slide.querySelector('.capa-foto .circulo, .capa-foto.moldura img, .foto-canto');
  if (!block || !footer) return 1;
  const textRects = () => {
    const rects = [];
    const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      if (!walker.currentNode.textContent.trim()) continue;
      const range = document.createRange();
      range.selectNodeContents(walker.currentNode);
      rects.push(...Array.from(range.getClientRects()));
    }
    // boxes that must not go under the photo either
    block.querySelectorAll('.cartao-siga').forEach((el) => rects.push(el.getBoundingClientRect()));
    return rects;
  };
  let scale = 1;
  for (; scale >= 0.66; scale -= 0.04) {
    block.style.setProperty('--escala', String(scale));
    const limit = footer.getBoundingClientRect().top - 24;
    const box = obstacle ? obstacle.getBoundingClientRect() : null;
    const ok = textRects().every((r) =>
      r.bottom <= limit && r.right <= 1040 &&
      (!box || r.right <= box.left + 8 || r.bottom <= box.top + 8 || r.top >= box.bottom)
    );
    if (ok) break;
  }
  return scale;
}`;
