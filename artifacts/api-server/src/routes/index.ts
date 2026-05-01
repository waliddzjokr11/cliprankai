import { Router, type IRouter } from "express";
import healthRouter from "./health";
import videosRouter from "./videos";
import paymentsRouter from "./payments";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/videos", videosRouter);
router.use("/payments", paymentsRouter);

export default router;
