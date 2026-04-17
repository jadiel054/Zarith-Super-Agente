import { Router, type IRouter } from "express";
import healthRouter from "./health";
import tasksRouter from "./tasks";
import chatRouter from "./chat";
import chatStreamRouter from "./chatStream";
import dashboardRouter from "./dashboard";
import authRouter from "./auth";
import settingsRouter from "./settings";
import voiceRouter from "./voice";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/auth", authRouter);
router.use("/tasks", tasksRouter);
router.use("/chat", chatRouter);
router.use("/chat", chatStreamRouter);
router.use("/dashboard", dashboardRouter);
router.use("/settings", settingsRouter);
router.use("/voice", voiceRouter);

export default router;
