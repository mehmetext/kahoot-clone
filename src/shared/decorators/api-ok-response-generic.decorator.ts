import { applyDecorators, Type } from '@nestjs/common';
import { ApiExtraModels, ApiOkResponse, getSchemaPath } from '@nestjs/swagger';
import { ApiResponse } from '../interfaces/api-response';

export const ApiOkResponseGeneric = <DataDto extends Type<unknown>>(
  dataDto: DataDto,
  options?: { isArray: boolean },
) => {
  return applyDecorators(
    ApiExtraModels(ApiResponse, dataDto),
    ApiOkResponse({
      schema: {
        allOf: [
          { $ref: getSchemaPath(ApiResponse) },
          {
            properties: {
              data: options?.isArray
                ? {
                    type: 'array',
                    items: { $ref: getSchemaPath(dataDto) },
                  }
                : {
                    $ref: getSchemaPath(dataDto),
                  },
            },
          },
        ],
      },
    }),
  );
};
