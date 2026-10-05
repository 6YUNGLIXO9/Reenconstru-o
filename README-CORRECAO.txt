Berserk Eclipse — arquivos corrigidos/conectados

- O index.html já carrega /src/main.tsx.
- A pasta src/ já usa TypeScript/TSX e seus imports relativos foram verificados.
- package.json, package-lock.json e tsconfig.json foram MANTIDOS intactos porque npm/Vite/TypeScript dependem desses nomes/formato.
- Também foram criados package.js, package-lock.js e tsconfig.js como espelhos JS, sem remover os JSON originais.
- vite.config.ts foi MANTIDO como TypeScript e não deve ser carregado pelo index.html.
- Não há arquivos .json dentro de src/ neste projeto.
- Não foram alterados os códigos da pasta src/.
