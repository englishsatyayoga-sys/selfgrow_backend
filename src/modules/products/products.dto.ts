import { pickLocale, SupportedLocale } from '../../utils/localized';

export interface PublicProductDTO {
  id: string;
  slug: string;
  name: string;
  description: string;
  priceInPaise: number;
  currency: string;
  autoRelease: boolean;
  assessment?: {
    id: string;
    slug: string;
    title: string;
    description: string;
    kind: string;
    timeLimitSeconds: number | null;
    questionsCount?: number;
  };
}

export const mapProductToPublicDTO = (product: any, locale: SupportedLocale = 'en'): PublicProductDTO => {
  const dto: PublicProductDTO = {
    id: product.id,
    slug: product.slug,
    name: pickLocale(product.name, locale),
    description: pickLocale(product.description, locale),
    priceInPaise: product.priceInPaise,
    currency: product.currency,
    autoRelease: product.autoRelease,
  };

  if (product.assessment) {
    dto.assessment = {
      id: product.assessment.id,
      slug: product.assessment.slug,
      title: pickLocale(product.assessment.title, locale),
      description: pickLocale(product.assessment.description, locale),
      kind: product.assessment.kind,
      timeLimitSeconds: product.assessment.timeLimitSeconds,
      questionsCount: product.assessment.questions?.length ?? 0,
    };
  }

  return dto;
};

