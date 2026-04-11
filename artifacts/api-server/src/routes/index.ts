import { Router, type IRouter } from "express";
import healthRouter from "./health";
import tasksRouter from "./tasks";
import chatRouter from "./chat";
import dashboardRouter from "./dashboard";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/tasks", tasksRouter);
router.use("/chat", chatRouter);
router.use("/dashboard", dashboardRouter);

export default router;
