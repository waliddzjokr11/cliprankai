import { Router, type IRouter } from "express";
import healthRouter from "./health";
import videosRouter from "./videos";
import uploadRouter from "./upload";
import paymentsRouter from "./payments";
import creditsRouter from "./credits";
import adminRouter from "./admin";
import contactRouter from "./contact";
import configRouter from "./config";
import accessRequestsRouter from "./accessRequests";

const router: IRouter = Router();

router.use(healthRouter);
// Upload + SSE routes must be registered BEFORE the generic /videos routes
router.use("/videos", uploadRouter);
router.use("/videos", videosRouter);
router.use("/payments", paymentsRouter);
router.use("/credits", creditsRouter);
router.use("/admin", adminRouter);
router.use("/contact", contactRouter);
router.use("/config", configRouter);
router.use("/access-requests", accessRequestsRouter);

export default router;
