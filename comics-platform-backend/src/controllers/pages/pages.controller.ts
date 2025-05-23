import { Body, Controller, Delete, Get, Param, Post, Query, Request, UploadedFile, UploadedFiles, UseGuards, UseInterceptors } from '@nestjs/common';
import { AuthGuard } from 'src/guards/auth.guards';
import { FilesInterceptor } from '@nestjs/platform-express';
import { PagesService } from 'src/services/pages/pages.service';
import { ReorderDto } from 'src/dto/reorder.dto';
import { fileFilter } from '../../utils/image-file.filter'

@Controller('pages')
export class PagesController {

    constructor(private readonly pagesService: PagesService){}

    @Get('/episode/:episodeId')
    async getPagesPublic(
        @Param('episodeId') episodeId: number,
        @Query('page') page: number = 1
    ) {
        return this.pagesService.getPagesByEpisode(episodeId, undefined, page);
    }


    @UseGuards(AuthGuard)
    @Get('/episode/edit/:episodeId')
    async getPagesForEdit(
        @Param('episodeId') episodeId: number,
        @Request() req
    ) {
        const username = req.user.username;
        return this.pagesService.getPagesByEpisode(episodeId, username);
    }

    @UseGuards(AuthGuard)
    @UseInterceptors(FilesInterceptor('images', 100, { fileFilter }))
    @Post(':episodeId')
    async uploadPages(
        @Param('episodeId') episodeId: number,
        @UploadedFiles() images: Express.Multer.File[],
        @Request() req
    ) {
        const username = req.user.username;
        return await this.pagesService.createPagesWithUpload(episodeId, images, username);
    }

    @UseGuards(AuthGuard)
    @Post('/reorder/:episodeId')
    async reorderPages(@Param('episodeId') episodeId: number, @Body() dto: ReorderDto, @Request() req) {
        const username = req.user.username;
        return await this.pagesService.reorder(dto, username, episodeId);
    }

    @UseGuards(AuthGuard)
    @Delete(':id')
    async deletePage(@Param('id') id: number, @Request() req){
        const username = req.user.username;
        return await this.pagesService.deletePage(id, username);
    }


}