import { Controller, Get, Post, Patch, Delete, Body, Param, ParseIntPipe, UseGuards } from '@nestjs/common';
import { TasksService } from './tasks.service';
import type { Task } from './task.entity';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';

class CreateTaskDto {
  text: string;
  priority?: string;
}

class UpdateTaskDto {
  text?: string;
  isCompleted?: boolean;
  priority?: string;
}

@Controller('tasks')
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Get('version')
  getVersion(): any {
    return {
      status: 'ok',
      version: 'v1.4.0',
      message: 'Secure full-stack build'
    };
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  findAll(@CurrentUser() user: any): Promise<Task[]> {
    return this.tasksService.findAll(user.userId);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  create(
    @Body() createTaskDto: CreateTaskDto,
    @CurrentUser() user: any,
  ): Promise<Task> {
    return this.tasksService.create(createTaskDto.text, user.userId, createTaskDto.priority);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateTaskDto: UpdateTaskDto,
    @CurrentUser() user: any,
  ): Promise<Task> {
    return this.tasksService.update(id, user.userId, updateTaskDto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  delete(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: any,
  ): Promise<void> {
    return this.tasksService.delete(id, user.userId);
  }
}
