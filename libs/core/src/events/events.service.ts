/* eslint-disable @typescript-eslint/no-unused-vars */
import { Injectable } from '@nestjs/common';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';

import { ReserveSpotDto } from './dto/reserve-spot.dto';
import { SpotStatus, TicketStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class EventsService {
  constructor(private PrismaService: PrismaService) {}

  create(createEventDto: CreateEventDto) {
    return this.PrismaService.event.create({
      data: createEventDto,
    });
  }

  findAll() {
    return this.PrismaService.event.findMany();
  }

  findOne(id: string) {
    return this.PrismaService.event.findUnique({
      where: { id: id },
    });
  }

  update(id: string, updateEventDto: UpdateEventDto) {
    return this.PrismaService.event.update({
      data: { ...updateEventDto },
      where: { id },
    });
  }

  remove(id: string) {
    return this.PrismaService.event.delete({
      where: { id },
    });
  }

  async reserveSpots(dto: ReserveSpotDto & { eventId: string }) {
    const spots = await this.PrismaService.spot.findMany({
      where: {
        eventId: dto.eventId,
        name: {
          in: dto.spots,
        },
      },
    });

    if (spots.length !== dto.spots.length) {
      const foundSpotsName = spots.map((spot) => spot.name);
      const notFoundSpotsName = dto.spots.filter(
        (spotName) => !foundSpotsName.includes(spotName),
      );
      throw new Error(`Spots ${notFoundSpotsName.join(', ')} not found`);
    }

    // modo transação
    try {
      const tickets = await this.PrismaService.$transaction(
        async (prisma) => {
          await prisma.reservationHistory.createMany({
            data: spots.map((spot) => ({
              spotId: spot.id,
              ticketKind: dto.ticket_kind,
              email: dto.email,
              status: TicketStatus.reserved,
            })),
          });

          await prisma.spot.updateMany({
            where: {
              id: {
                in: spots.map((spot) => spot.id),
              },
            },
            data: {
              status: SpotStatus.reserved,
            },
          });

          // Await the Promise.all to get the created tickets
          const createdTickets = await Promise.all(
            spots.map((spot) => {
              return prisma.ticket.create({
                data: {
                  spotId: spot.id,
                  ticketKind: dto.ticket_kind,
                  email: dto.email,
                },
              });
            }),
          );

          return createdTickets; // Return the created tickets
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.ReadUncommitted },
        // Só sera possivel ler registros ja commitados no banco de dados
      );

      return tickets;
    } catch (error) {
      console.log('error on transaction reserve spot', error.message);
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        switch (error.code) {
          case 'P2002':
            throw new Error('Spot already reserved');
          case 'P2034':
            throw new Error('Spot transaction conflict');
          default:
            throw new Error('error unkown');
        }
      }
    }
  }
}
