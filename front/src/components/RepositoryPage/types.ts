export type RepoType = 'github' | 'design' | 'documentation' | 'other';

export type RepoLink = {
  id: string;
  label: string;
  description: string;
  url: string;
  type: RepoType;
};

export type CommitEntry = {
  id: string;
  sha: string;
  message: string;
  author: string;
  timestamp: string;
};

