import {Request, Response } from 'express';

import db from '../database/connection';
import convertHourToMinutes from '../utils/convertHourToMinutes';
/*  Propriedades de agendamento do horário de um professor 
 /  para converter a string que o usuário passar para 
 /  um valor inteiro que será reconhecido e convertido para
 /  o banco
*/ 
interface ScheduleItem {
    week_day: number;
    from: string;
    to: string;
}

export default class ClassesController {

    async index(request: Request, response: Response) {
        const filters = request.query;

        const week_day = filters.week_day as string;
        const subject = filters.subject as string;
        const time = filters.time as string;

        if(!week_day || !subject || !time) {
            return response.status(400).json({
                error: 'Missing filters to search classes'
            })
        }

        const timeInMinutes = convertHourToMinutes(time);

        const classes = await db('classes')
            .whereExists(function() {
                this.select('class_schedule.*')
                .from('class_schedule')
                .whereRaw('`class_schedule`.`class_id` = `classes`.`id`')
                .whereRaw('`class_schedule`.`week_day` = ??', [Number(week_day)])
                .whereRaw('`class_schedule`.`from` <= ??', [timeInMinutes])
                .whereRaw('`class_schedule`.`from` > ??', [timeInMinutes])
            })
            .where('classes.subject', '=', subject)
            .join('users', 'classes.user_id', '=', 'users.id')
            .select(['classes.*', 'users.*']);

        return response.json(classes);
    }

    async create(request: Request, response: Response) {
        const {
            name,
            avatar,
            whatsapp,
            bio,
            subject,
            cost,
            schedule
        } = request.body;
    
        // Se uma inserção falhar, as outras não serão executadas, já que uma depende de outra
        const trx = await db.transaction(); 
    
        try {
            // Salvando os dados de um professor
            const insertedUserUds = await trx('users').insert({
                name,
                avatar,
                whatsapp,
                bio,
            });
        
            // Pegar o id do professor que foi inserido no bd
            const user_id = insertedUserUds[0];
        
            // Salvando a matéria e custo da mesma no db, pegando o id do professor inserido por último
            const insertedClassesIds = await trx('classes').insert({
                subject,
                cost,
                user_id,
            });
        
            // Pegar o id da classe (matéria e custo) que foi inserido no db
            const class_id = insertedClassesIds[0];
        
            // Salvando o agendamento (dia da semana, e horarios) do professor no db
            const classSchedule = schedule.map((scheduleItem: ScheduleItem) => {
                return {
                    class_id,
                    week_day: scheduleItem.week_day,
                    from: convertHourToMinutes(scheduleItem.from),
                    to: convertHourToMinutes(scheduleItem.to),
                }
            })
        
            await trx('class_schedule').insert(classSchedule);
        
            await trx.commit();
        
            return response.status(201).send(); 
        } catch (error) {
            await trx.rollback();
    
            return response.status(400).json({
                error: 'Unexpected error while creating new class'
            })
        }
    }

}