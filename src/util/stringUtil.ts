import * as pluralize from 'pluralize';

export const capitalizeFirstLetter = (str: string): string => str.slice(0, 1).toUpperCase() + str.slice(1);

export const camelize = (str: string): string =>
  str
    .replace(/(?:^\w|[A-Z]|_\w|\b\w)/g, (word, index) => (index == 0 ? word.toLowerCase() : word.toUpperCase()))
    .replace(/\s|_|-+/g, '');

export const plural = (str: string): string => pluralize(str);
