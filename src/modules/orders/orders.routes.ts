import { Router } from 'express';
import {
  createOrder,
  verifyPayment,
  listMyOrders,
  getOrderById,
} from './orders.controller';
import {
  createOrderSchema,
  verifyPaymentSchema,
  orderIdParamSchema,
  listMyOrdersQuerySchema,
} from './orders.schema';
import { validate } from '../../middlewares/validate';
import { authenticate } from '../../middlewares/authenticate';

const router = Router();

router.use(authenticate);

router.post('/', validate(createOrderSchema), createOrder);
router.post('/:id/verify', validate(verifyPaymentSchema), verifyPayment);
router.get('/', validate(listMyOrdersQuerySchema), listMyOrders);
router.get('/:id', validate(orderIdParamSchema), getOrderById);

export const ordersRoutes = router;

