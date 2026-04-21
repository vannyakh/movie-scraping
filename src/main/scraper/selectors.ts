export const CATEGORY_SELECTORS = [
  'nav a[href]',
  '.main-menu a[href]',
  '.menu-main a[href]',
  '.primary-menu a[href]',
  '.nav-menu a[href]',
  '.navbar a[href]',
  '.genres a[href]',
  '.categories a[href]',
  '.the-loai a[href]',
  '.genre-list a[href]',
  '.cat-list a[href]',
  'header nav a[href]',
  'header ul a[href]',
  '.header-menu a[href]',
  '#main-nav a[href]',
  '#menu-primary a[href]',
  '.menu a[href]',
  'ul.nav a[href]',
]

export const SKIP_URL_KEYWORDS = [
  'login', 'logout', 'register', 'signup', 'search', 'tim-kiem',
  'about', 'contact', 'privacy', 'terms', 'sitemap', 'rss', 'feed',
  'dang-nhap', 'dang-ky', 'lien-he', 'gioi-thieu',
  'javascript:', 'mailto:', 'tel:', '#',
]

export const LIST_SELECTORS = [
  '.movie-item a[href]',
  '.film-item a[href]',
  '.item .thumb a[href]',
  '.item a.thumb[href]',
  '.item h3 a[href]',
  '.item h2 a[href]',
  '.item .name a[href]',
  '.item .title a[href]',
  'article.item a[href]',
  'article a.thumb[href]',
  'article .thumb a[href]',
  'article h3 a[href]',
  '.phim-item a[href]',
  '.phim a[href]',
  '.thumb-item a[href]',
  '.box-phim a[href]',
  '.movies-list a.thumb[href]',
  '.card a[href]',
  '.card-item a[href]',
  '.movie a[href]',
  '.movies a[href]',
  '.film a[href]',
  '.post-item a[href]',
  '.entry-title a[href]',
  'h2.entry-title a[href]',
  'h3.entry-title a[href]',
  '.grid-item a[href]',
  '.list-movie a[href]',
  '.list-film a[href]',
]

export const NEXT_PAGE_SELECTORS = [
  'a.next[href]',
  'a[rel="next"][href]',
  '.pagination .next a[href]',
  '.pagination a[aria-label="Next"][href]',
  '.page-numbers.next[href]',
  'a.page-numbers.next[href]',
  '.pager-next a[href]',
  '.next-page a[href]',
  'li.next a[href]',
  'a[title="Next page"][href]',
  'a[title="Trang sau"][href]',
  '.phan-trang .next[href]',
]

export const MOVIE_URL_PATTERNS = [
  '/phim/', '/xem-phim/', '/movie/', '/movies/',
  '/film/', '/films/', '/watch/', '/detail/',
  '/truyen-hinh/', '/series/', '/tap-', '/episode',
]

export const VIDEO_URL_RE = /\.(m3u8|mp4|mkv|webm|mpd)(\?.*)?$/i
export const VIDEO_PATH_RE = /\/(manifest|playlist|index)\.(m3u8|mpd)/i
export const VIDEO_HINT_RE = /\/(hls|dash|stream|video)\//i
