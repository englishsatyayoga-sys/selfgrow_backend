import { QuestionType } from '@prisma/client';

export interface ScoredOption {
  id: string;
  score: number;
}

export interface QuestionForScoring {
  id: string;
  type: QuestionType | string;
  dimension?: string | null;
  options?: ScoredOption[];
}

export interface ResponseForScoring {
  questionId: string;
  selectedOptionIds: string[];
  textAnswer?: string | null;
}

export interface DimensionScore {
  score: number;
  maxScore: number;
  percentage: number;
}

export interface ScoreSummary {
  totalScore: number;
  maxTotalScore: number;
  percentage: number;
  dimensions: Record<string, DimensionScore>;
  textAnswers: Array<{ questionId: string; text: string }>;
  scoredAt: string;
  strategyUsed: string;
}

export type ScoringStrategy = (
  questions: QuestionForScoring[],
  responses: ResponseForScoring[]
) => ScoreSummary;

/**
 * Pure function: Default scoring strategy.
 * Sums option scores per question.dimension plus total.
 * TEXT answers are preserved in textAnswers for downstream AI processing without affecting numeric scores.
 */
export const defaultScoringStrategy: ScoringStrategy = (
  questions: QuestionForScoring[],
  responses: ResponseForScoring[]
): ScoreSummary => {
  const responseMap = new Map<string, ResponseForScoring>();
  for (const resp of responses) {
    responseMap.set(resp.questionId, resp);
  }

  let totalScore = 0;
  let maxTotalScore = 0;
  const dimensionAccumulator: Record<string, { score: number; maxScore: number }> = {};
  const textAnswers: Array<{ questionId: string; text: string }> = [];

  for (const question of questions) {
    const userResponse = responseMap.get(question.id);

    if (question.type === QuestionType.TEXT) {
      if (userResponse?.textAnswer) {
        textAnswers.push({
          questionId: question.id,
          text: userResponse.textAnswer,
        });
      }
      continue;
    }

    const options = question.options || [];
    const optionScoreMap = new Map<string, number>();
    for (const opt of options) {
      optionScoreMap.set(opt.id, opt.score);
    }

    // Determine max achievable score for this question
    let qMaxScore = 0;
    if (question.type === QuestionType.SINGLE_CHOICE) {
      const scores = options.map((o) => o.score);
      qMaxScore = scores.length > 0 ? Math.max(...scores, 0) : 0;
    } else if (question.type === QuestionType.MULTI_CHOICE) {
      qMaxScore = options.filter((o) => o.score > 0).reduce((sum, o) => sum + o.score, 0);
    }

    // Calculate user's score for this question
    let qUserScore = 0;
    if (userResponse?.selectedOptionIds) {
      for (const optId of userResponse.selectedOptionIds) {
        qUserScore += optionScoreMap.get(optId) || 0;
      }
    }

    totalScore += qUserScore;
    maxTotalScore += qMaxScore;

    const dimension = question.dimension || 'General';
    if (!dimensionAccumulator[dimension]) {
      dimensionAccumulator[dimension] = { score: 0, maxScore: 0 };
    }
    dimensionAccumulator[dimension].score += qUserScore;
    dimensionAccumulator[dimension].maxScore += qMaxScore;
  }

  const dimensions: Record<string, DimensionScore> = {};
  for (const [dim, val] of Object.entries(dimensionAccumulator)) {
    dimensions[dim] = {
      score: val.score,
      maxScore: val.maxScore,
      percentage: val.maxScore > 0 ? Math.round((val.score / val.maxScore) * 100) : 0,
    };
  }

  const overallPercentage =
    maxTotalScore > 0 ? Math.round((totalScore / maxTotalScore) * 100) : 0;

  return {
    totalScore,
    maxTotalScore,
    percentage: overallPercentage,
    dimensions,
    textAnswers,
    scoredAt: new Date().toISOString(),
    strategyUsed: 'DEFAULT_DIMENSION_SUM',
  };
};

export class ScoringService {
  private strategies: Map<string, ScoringStrategy> = new Map();

  constructor() {
    this.strategies.set('default', defaultScoringStrategy);
  }

  registerStrategy(key: string, strategy: ScoringStrategy): void {
    this.strategies.set(key, strategy);
  }

  calculateScore(
    strategyKey: string | null | undefined,
    questions: QuestionForScoring[],
    responses: ResponseForScoring[]
  ): ScoreSummary {
    const strategy =
      (strategyKey && this.strategies.get(strategyKey)) ||
      this.strategies.get('default') ||
      defaultScoringStrategy;

    return strategy(questions, responses);
  }
}

export const scoringService = new ScoringService();

