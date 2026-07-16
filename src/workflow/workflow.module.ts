import { Module } from '@nestjs/common';
import { WorkflowService } from './workflow.service';
import { WorkflowGateway } from './workflow.gateway';

@Module({
  providers: [WorkflowService, WorkflowGateway],
})
export class WorkflowModule {}
