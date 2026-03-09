import { Room } from 'src/modules/room/entities/room.entity';
import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('player_results')
export class PlayerResult {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'text' })
  playerName: string;

  @Column({ type: 'int', default: 0 })
  finalScore: number;

  @ManyToOne(() => Room, (room) => room.results, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'room_id' })
  room: Room;

  @CreateDateColumn({ type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updatedAt: Date;

  @DeleteDateColumn({ type: 'timestamp', nullable: true })
  deletedAt?: Date;
}
