import { Injectable } from '@nestjs/common';
import type { PipeTransform } from '@nestjs/common';
import type { CreateMessageDto } from '../dto/create-message.dto.js';
import type { ListMessagesDto } from '../dto/list-messages.dto.js';
import { validateMessage, validatePagination } from '../dto/message-validation.js';

@Injectable()
export class CreateMessagePipe implements PipeTransform<unknown, CreateMessageDto> {
  transform(value: unknown): CreateMessageDto { return validateMessage(value); }
}

@Injectable()
export class ListMessagesPipe implements PipeTransform<Record<string, unknown>, ListMessagesDto> {
  transform(value: Record<string, unknown>): ListMessagesDto { return validatePagination(value); }
}
