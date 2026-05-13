/**
 * Ambient declarations pra side-effect imports que o Next.js trata via
 * build system (CSS, fontes, etc.). Sem isso o TS Server do editor reclama:
 *   "Cannot find module or type declarations for side-effect import"
 *
 * `tsc --noEmit` no terminal não tinha problema porque carrega
 * `next-env.d.ts` → tipos do `next` package, que cobrem CSS. Mas o LSP do
 * VS Code (com TS 5.6 + moduleResolution: 'bundler') às vezes não resolve
 * essa cadeia em tempo real. Esse arquivo é explícito e idempotente —
 * cobre o gap sem mexer no next-env.d.ts (que o Next regenera).
 */

declare module '*.css';
declare module '*.scss';
declare module '*.sass';

// CSS Modules — caso um dia importemos como `import styles from './foo.module.css'`.
declare module '*.module.css' {
  const classes: Record<string, string>;
  export default classes;
}
declare module '*.module.scss' {
  const classes: Record<string, string>;
  export default classes;
}

// Imagens importadas via `import logo from './logo.svg'`. Next já cobre via
// `next/image-types/global`, mas redeclarar não faz mal.
declare module '*.svg' {
  const src: string;
  export default src;
}
declare module '*.png' {
  const src: string;
  export default src;
}
declare module '*.jpg' {
  const src: string;
  export default src;
}
declare module '*.webp' {
  const src: string;
  export default src;
}
