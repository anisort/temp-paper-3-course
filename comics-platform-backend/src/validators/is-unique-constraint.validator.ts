import { ValidatorConstraintInterface, ValidationArguments, ValidatorConstraint } from "class-validator";
import { IsUniqueConstraintInput } from "./is-unique";
import { EntityManager } from 'typeorm';
import { Injectable } from "@nestjs/common";

@ValidatorConstraint({name: 'IsUniqueConstraint', async: true})
@Injectable()
export class IsUniqueConstraint implements ValidatorConstraintInterface {

    constructor(private readonly entityManager: EntityManager){}

    async validate(
        value: any,
        args?: ValidationArguments,
    ): Promise<boolean> {
        const { tableName, column}: IsUniqueConstraintInput = args?.constraints[0];
        const exists = await this.entityManager.getRepository(tableName).createQueryBuilder(tableName).where({[column]: value}).getExists();
        return exists ? false : true;
    }

    defaultMessage(validationArguments?: ValidationArguments): string {
        const column = validationArguments?.constraints[0]?.column;
        return `The value for column '${column}' already exists. Please choose a different value.`;
    }
}
