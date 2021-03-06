import { SerializedColumn } from '../serialized/serializedColumn';
import { TableHandler } from '../serializable/table';
import { BaseColumn, NormalColumn, ReferenceColumn } from '../serializable/column';

export const assembleColumn = (data: SerializedColumn, table: TableHandler): BaseColumn => {
  if (data.hasReference) {
    return new ReferenceColumn(data, table);
  }
  return new NormalColumn(data, table);
};
