import { RepoLink, CommitEntry } from './types';

export const INITIAL_REPO_LINKS: RepoLink[] = [
  {
    id: 'repo-frontend',
    label: 'Frontend · Kanban Web',
    description: 'Repositorio principal del cliente React con Tailwind.',
    url: 'https://github.com/empresa/kanban-frontend',
    type: 'github',
  },
  {
    id: 'repo-backend',
    label: 'Backend · API Kanban',
    description: 'Servicios Node/Koa, autenticación y tareas.',
    url: 'https://github.com/empresa/kanban-backend',
    type: 'github',
  },
  {
    id: 'repo-design',
    label: 'Librería de diseño',
    description: 'Componentes Figma, tokens y guidelines.',
    url: 'https://www.figma.com/file/kanban-design-system',
    type: 'design',
  },
  {
    id: 'repo-docs',
    label: 'Documentación técnica',
    description: 'Confluence con ADRs, diagramas y checklist de releases.',
    url: 'https://docs.empresa.com/kanban',
    type: 'documentation',
  },
];

export const COMMITS: CommitEntry[] = [
  {
    id: 'commit-001',
    sha: 'a4f9c21',
    message: 'refactor(board): mejora drag & drop y estados visuales',
    author: 'Carlos Ortega',
    timestamp: '12 Abr · 11:32',
  },
  {
    id: 'commit-002',
    sha: 'bb1d8f3',
    message: 'feat(profile): pestaña estadísticas con métricas reales',
    author: 'Ana Rodríguez',
    timestamp: '12 Abr · 08:05',
  },
  {
    id: 'commit-003',
    sha: 'c7e5310',
    message: 'chore(ci): añade job de linting y pruebas e2e',
    author: 'María Sánchez',
    timestamp: '11 Abr · 19:48',
  },
  {
    id: 'commit-004',
    sha: 'd9aa4c9',
    message: 'fix(releases): corrige fechas en timeline',
    author: 'Daniel Pérez',
    timestamp: '11 Abr · 15:31',
  },
];

export const REPO_TYPE_LABELS = {
  github: 'GitHub',
  design: 'Design',
  documentation: 'Docs',
  other: 'Link',
} as const;

