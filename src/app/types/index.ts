export interface EditProposal {
  oldContent: string;
  newContent: string;
  description: string;
  isSafe: boolean;
  replaceAll?: boolean; // If true, replace all occurrences
}
