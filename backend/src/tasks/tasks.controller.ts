import { Controller, Get, Post, Body } from '@nestjs/common';
import { TasksService } from './tasks.service';
import type { Task } from './task.entity';

class CreateTaskDto {
  text: string;
}

@Controller('tasks')
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Get()
  findAll(): Promise<Task[]> {
    return this.tasksService.findAll();
  }

  @Post()
  create(@Body() createTaskDto: CreateTaskDto): Promise<Task> {
    return this.tasksService.create(createTaskDto.text);
  }
}
