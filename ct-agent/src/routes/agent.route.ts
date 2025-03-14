import { Router } from 'express';
import { Request, Response } from 'express';

import { angetHandler, getStreamChunks } from '../controllers/agent.controller';

const agentRouter: Router = Router();

agentRouter.post('/', angetHandler);

agentRouter.get('/stream/:requestId', getStreamChunks);

agentRouter.get('/', (req: Request, res: Response) => {
  if (req.query.stream) {
    const newReq = Object.assign({}, req, {
      params: {
        ...req.params,
        requestId: req.query.stream as string
      }
    });
    
    return getStreamChunks(newReq, res);
  }
  res.status(400).json({ error: 'Missing required parameters' });
});

agentRouter.post('/stream', (req: Request, res: Response) => {
  if (req.body && req.body.requestId) {
    const newReq = Object.assign({}, req, {
      params: {
        ...req.params,
        requestId: req.body.requestId
      },
      query: {
        ...req.query,
        since: req.body.since
      }
    });
    
    return getStreamChunks(newReq, res);
  }
  res.status(400).json({ error: 'Missing required parameters' });
});

export default agentRouter;
