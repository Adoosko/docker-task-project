import { Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { Task } from './task.entity';

@Injectable()
export class TasksService {
  constructor(
    @InjectRepository(Task)
    private readonly taskRepository: Repository<Task>,
  ) {}

  findAll(userId: number): Promise<Task[]> {
    return this.taskRepository.find({
      where: [
        { user: { id: userId } },
        { user: IsNull() } // Backwards compatibility: show old unassigned tasks
      ],
      order: {
        isCompleted: 'ASC',
        createdAt: 'DESC',
      },
    });
  }

  create(text: string, userId: number, priority?: string): Promise<Task> {
    const newTask = this.taskRepository.create({
      text,
      priority: priority || 'medium',
      user: { id: userId },
    });
    return this.taskRepository.save(newTask);
  }

  async update(id: number, userId: number, attrs: Partial<Task>): Promise<Task> {
    const task = await this.taskRepository.findOne({
      where: { id },
      relations: { user: true },
    });
    if (!task) {
      throw new NotFoundException(`Task with ID ${id} not found`);
    }
    if (task.user && task.user.id !== userId) {
      throw new UnauthorizedException('You do not have permission to update this task');
    }
    // Remove user attribute from updates to prevent altering ownership
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { user, ...updateAttrs } = attrs as any;
    Object.assign(task, updateAttrs);
    return this.taskRepository.save(task);
  }

  async delete(id: number, userId: number): Promise<void> {
    const task = await this.taskRepository.findOne({
      where: { id },
      relations: { user: true },
    });
    if (!task) {
      throw new NotFoundException(`Task with ID ${id} not found`);
    }
    if (task.user && task.user.id !== userId) {
      throw new UnauthorizedException('You do not have permission to delete this task');
    }
    await this.taskRepository.remove(task);
  }
}

