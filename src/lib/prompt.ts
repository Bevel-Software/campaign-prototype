import type { QuestionChoice, QuestionConfig } from './types';

/**
 * Always: basePrompt + single fragment (question answer or custom edit).
 */
export function composePrompt(
  basePrompt: string,
  fragment: string,
): string {
  return `${basePrompt}. ${fragment}`;
}

export function getAnnotation(
  question: QuestionConfig | null,
  choice: QuestionChoice | null,
  customEdit?: string,
): string {
  if (customEdit) {
    const preview = customEdit.trim().slice(0, 30);
    return `Custom: ${preview}${customEdit.trim().length > 30 ? '...' : ''}`;
  }
  if (question && choice) {
    return `${question.text}: ${choice.label}`;
  }
  return 'Generated';
}
