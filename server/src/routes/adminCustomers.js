
import express from 'express';

const STOCK_RELEASABLE_STATUSES = [
  'placed',
  'confirmed',
  'processing'
];

export function createAdminCustomersRouter({
  User,
  Order,
  Item,
  Product,
  mongoose,
  requireAuth,
  requireAdmin
}) {
  const router = express.Router();

  // GET /api/admin/customers
  // Only admins can see the customer list.
  router.get('/', requireAuth, requireAdmin, async (req, res, next) => {
    try {
      const customers = await User.find({ role: 'user' })
        .select('email createdAt')
        .sort({ createdAt: -1 })
        .lean();

      const orderCounts = await Order.aggregate([
        {
          $group: {
            _id: '$userId',
            orderCount: { $sum: 1 }
          }
        }
      ]);

      const countByUser = new Map(
        orderCounts.map((entry) => [
          entry._id.toString(),
          entry.orderCount
        ])
      );

      return res.json({
        customers: customers.map((customer) => ({
          id: customer._id.toString(),
          email: customer.email,
          createdAt: customer.createdAt,
          orderCount: countByUser.get(customer._id.toString()) || 0
        }))
      });
    } catch (error) {
      return next(error);
    }
  });

  // DELETE /api/admin/customers/:id
  // Permanently deletes a customer and their orders.
  router.delete(
    '/:id',
    requireAuth,
    requireAdmin,
    async (req, res, next) => {
      const { id } = req.params;

      if (!mongoose.isValidObjectId(id)) {
        return res.status(400).json({
          error: 'Invalid customer ID.'
        });
      }

      const session = await mongoose.startSession();
      let result = null;

      try {
        await session.withTransaction(async () => {
          result = null;

          // Only customer accounts can be deleted here.
          const customer = await User.findOne({
            _id: id,
            role: 'user'
          })
            .session(session)
            .lean();

          if (!customer) {
            return;
          }

          const orders = await Order.find({
            userId: customer._id
          })
            .select('productId quantity status stockRestored')
            .session(session)
            .lean();

          // Return reserved stock for orders that have not shipped.
          for (const order of orders) {
            if (
              STOCK_RELEASABLE_STATUSES.includes(order.status) &&
              !order.stockRestored
            ) {
              const stockUpdate = await Product.updateOne(
                { _id: order.productId },
                { $inc: { stock: order.quantity } },
                { session }
              );

              if (stockUpdate.matchedCount !== 1) {
                throw new Error(
                  'Could not restore stock for an order being deleted.'
                );
              }
            }
          }

          // Delete all orders belonging to the customer.
          await Order.deleteMany(
            { userId: customer._id },
            { session }
          );

          // Also clean up legacy personal workspace records.
          await Item.deleteMany(
            { userId: customer._id },
            { session }
          );

          const deletion = await User.deleteOne(
            {
              _id: customer._id,
              role: 'user'
            },
            { session }
          );

          if (deletion.deletedCount !== 1) {
            throw new Error('Could not delete the customer account.');
          }

          result = {
            email: customer.email,
            ordersDeleted: orders.length
          };
        });

        if (!result) {
          return res.status(404).json({
            error: 'Customer not found.'
          });
        }

        return res.json({
          message:
            `Deleted ${result.email} and ${result.ordersDeleted} order(s).`,
          customer: result
        });
      } catch (error) {
        return next(error);
      } finally {
        await session.endSession();
      }
    }
  );

  return router;
}
