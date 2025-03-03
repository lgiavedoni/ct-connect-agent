import { Router } from 'express';

import { angetHandler } from '../controllers/agent.controller';

const agentRouter: Router = Router();

agentRouter.post('/', angetHandler);

export default agentRouter;
