import { Router, type IRouter } from "express";
import healthRouter from "./health";
import videosRouter from "./videos";
import uploadRouter from "./upload";
import paymentsRouter from "./payments";
import creditsRouter from "./credits";

const router: IRouter = Router();

router.use(healthRouter);
// Upload + SSE routes must be registered BEFORE the generic /videos routes
router.use("/videos", uploadRouter);
router.use("/videos", videosRouter);
router.use("/payments", paymentsRouter);
router.use("/credits", creditsRouter);

export default router;
