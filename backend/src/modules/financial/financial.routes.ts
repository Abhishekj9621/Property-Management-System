import { Router } from "express";
import invoiceRoutes from "./invoices/invoices.routes";
import creditNoteRoutes from "./credit-notes/credit-notes.routes";
import refundRoutes from "./refunds/refunds.routes";
import taxRateRoutes from "./tax-rates/tax-rates.routes";
import ledgerRoutes from "./ledger/ledger.routes";
import periodCloseRoutes from "./period-close/period-close.routes";
import financialReportsRoutes from "./reports/financial-reports.routes";

const router = Router();

router.use("/invoices", invoiceRoutes);
router.use("/credit-notes", creditNoteRoutes);
router.use("/refunds", refundRoutes);
router.use("/tax-rates", taxRateRoutes);
router.use("/ledger", ledgerRoutes);
router.use("/period-close", periodCloseRoutes);
router.use("/reports", financialReportsRoutes);

export default router;
