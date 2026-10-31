import { Router } from 'express';
import {
  listTemplates,
  getTemplateById,
  createTemplate,
  createTemplateVersion,
  toggleTemplateActive,
} from './report-templates.controller';
import {
  createReportTemplateSchema,
  createTemplateVersionSchema,
  templateIdParamSchema,
  listTemplatesQuerySchema,
} from './report-templates.schema';
import { validate } from '../../middlewares/validate';
import { authenticate } from '../../middlewares/authenticate';
import { authorize } from '../../middlewares/authorize';
import { Role } from '@prisma/client';

const router = Router();

router.use(authenticate, authorize(Role.ADMIN));

router.get('/', validate(listTemplatesQuerySchema), listTemplates);
router.get('/:id', validate(templateIdParamSchema), getTemplateById);
router.post('/', validate(createReportTemplateSchema), createTemplate);
router.post('/:id/versions', validate(createTemplateVersionSchema), createTemplateVersion);
router.patch('/:id/toggle-active', validate(templateIdParamSchema), toggleTemplateActive);

export const reportTemplatesRoutes = router;

