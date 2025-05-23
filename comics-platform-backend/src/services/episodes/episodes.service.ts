import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { CreateEpisodeDto } from 'src/dto/create-episode.dto';
import { Episode } from 'src/entities/episode.entity';
import { In, Repository } from 'typeorm';
import { ComicsService } from '../comics/comics.service';
import { ReorderDto } from 'src/dto/reorder.dto';
import { EpisodeItemDto } from 'src/dto/episode-item.dto';
import { UploadService } from '../upload/upload.service';
import { EpisodeNotificationService } from '../episode-notification/episode-notification.service';

@Injectable()
export class EpisodesService {

    constructor(
        @InjectRepository(Episode)
        private episodeRepository: Repository<Episode>,
        private comicsService: ComicsService,
        private uploadService: UploadService,
        private readonly episodeNotificationService: EpisodeNotificationService,
    ){}

    async findByComic(comicId: number, username?: string): Promise<EpisodeItemDto[]> {
        const comic = await this.comicsService.findComicById(comicId);

        if(!comic){
            throw new NotFoundException('Comic not found');
        }
    
        const where: any = { comic: { id: comicId } };
    
        const isAuthor = username && comic?.user === username;
        if (!isAuthor) {
            where.isAvailable = true;
        }
    
        const episodes = await this.episodeRepository.find({
            where,
            order: { order: 'ASC' },
            relations: ['pages'],
        });
    
        return episodes.map((e) => ({
            id: e.id,
            name: e.name,
            order: e.order,
            isAvailable: e.isAvailable,
            created_at: e.created_at,
        }));
    }
        
      
    async createEpisode(createEpisodDto: CreateEpisodeDto, username: string): Promise<EpisodeItemDto> {

        const comic = await this.comicsService.findComicById(createEpisodDto.comicId);

        if(!comic || comic.user !== username){
            throw new NotFoundException('Comic not found');
        }

        const last = await this.episodeRepository.findOne({
          where: { comic: { id: createEpisodDto.comicId } },
          order: { order: 'DESC' }
        });
    
        const order = last ? last.order + 1 : 1;
    
        const episode = this.episodeRepository.create({
          name: createEpisodDto.name,
          order,
          comic: { id: createEpisodDto.comicId },
        });

        await this.episodeRepository.save(episode);
        return {
            id: episode.id,
            name: episode.name,
            order: episode.order,
            isAvailable: episode.isAvailable,
            created_at: episode.created_at,
        };
    }

    async updateName(episodeId: number, name: string, username: string ): Promise<Episode | null> {
        const episode = await this.findById(episodeId);

        const comic = episode.comic;
        if(!comic || comic.user.username !== username){
            throw new NotFoundException('Episode not found');
        }

        await this.episodeRepository.update(episodeId, { name });
        return await this.episodeRepository.findOne({where: {id: episodeId}});
    }

    async toggleAvailability(episodeId: number, username: string): Promise<Episode | null> {
        const episode = await this.findById(episodeId);

        const comic = episode.comic;
        if(!comic || comic.user.username !== username){
            throw new NotFoundException('Episode not found');
        }
    
        const newAvailability = !episode.isAvailable;
        episode.isAvailable = newAvailability;
        if (newAvailability) {
            episode.created_at = new Date();
            await this.episodeNotificationService.notifySubscribersAboutNewEpisode(comic, episode);
          }
        
          await this.episodeRepository.save(episode);
        
        return await this.episodeRepository.findOne({where: {id: episodeId}});
    }

    async reorder(dto: ReorderDto, username: string, comicId: number): Promise<EpisodeItemDto[]> {
        const comic = await this.comicsService.findComicById(comicId);
        if(!comic || comic.user !== username){
            throw new NotFoundException('Comic not found');
        }

        const episodes = await this.episodeRepository.find({
            where: {
                id: In(dto.idsInOrder),
                comic: { id: comicId },
            },
            relations: ['comic'],
        });
        
        if (episodes.length !== dto.idsInOrder.length) {
            throw new BadRequestException('Some episodes do not belong to the comic');
        }
        
        for (let i = 0; i < episodes.length; i++) {
            const episode = episodes.find(e => e.id === dto.idsInOrder[i]);
            if (episode) {
                episode.order = i + 1;
            }
        }
        await this.episodeRepository.save(episodes);

        return await this.episodeRepository.find({
            where: { comic: { id: comicId } },
            order: { order: 'ASC' },
        });
        
    }

    async delete(id: number, username: string): Promise<void> {

        const episode = await this.findById(id);

        if (!episode){
            throw new NotFoundException('Episode not found');
        }

        const comic = episode.comic;
        if(!comic || comic.user.username !== username){
            throw new NotFoundException('Episode not found');
        }

        await this.episodeRepository.delete(id);
    
        const remaining = await this.episodeRepository.find({
          where: { comic: { id: episode.comic.id } },
          order: { order: 'ASC' },
        });
    
        for (let i = 0; i < remaining.length; i++) {
          await this.episodeRepository.update(remaining[i].id, { order: i + 1 });
        }

        const pageUrls = episode.pages.map(page => page.imageUrl);
        await this.uploadService.deletePagesForEpisode(pageUrls);

    }

    async findById(episodeId: number): Promise<Episode>{
        const episode = await this.episodeRepository.findOne({
            where: { id: episodeId },
            relations: ['comic', 'comic.user', 'pages'],
        });
        if(!episode){
            throw new NotFoundException('Episode not found');
        }
        return episode;
    }

    async getComicIdByEpisode(episodeId: number): Promise<{comicId: number, episodeName: string}> {
        const episode = await this.findById(episodeId);
        return {comicId: episode.comic.id, episodeName: episode.name};
    }
    
    async isNameTaken(name: string, comicId: number): Promise<boolean> {
        return this.episodeRepository.exists({
            where: {
                name,
                comic: { id: comicId },
            },
        });
    }
    
      
}
