import { Router, type IRouter } from "express";
import healthRouter from "./health";
import videosRouter from "./videos";
import paymentsRouter from "./payments";
import creditsRouter from "./credits";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/videos", videosRouter);
router.use("/payments", paymentsRouter);
router.use("/credits", creditsRouter);

export default router;
