import type { DiscountCategory } from '../discount/index.ts';

export function formatDiscountLabel(
  category: DiscountCategory,
  ratePercent: number,
  labels: { seniorCitizen: string; pwd: string; student: string },
): string {
  const categoryLabel =
    category === 'senior_citizen' ? labels.seniorCitizen : category === 'pwd' ? labels.pwd : labels.student;
  return `${categoryLabel} ${ratePercent}%`;
}
