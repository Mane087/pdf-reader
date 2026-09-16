# PROYECTO

Lector de PDFs

## Enviroment

Angular 22 y TypeScript 6 (`@angular/compiler-cli` 22 exige TypeScript >=6.0 <6.1)

## Project conventions

- El código debe mantenerse en inglés.
- Para booleanos utiliza nombres descriptivos con prefijos como `is`, `has`, `can` o `should`.
- Los nombres deben ser claros y utilizar únicamente las palabras necesarias para expresar su propósito.
- Evita nombres genéricos o ambiguos cuando exista una alternativa descriptiva.
- Mantén consistencia con los patrones ya utilizados en el proyecto antes de introducir nuevas abstracciones.
- Usa `camelCase` para variables y funciones.
- Usa `PascalCase` para clases.
- Usa `kebab-case` para archivos y carpetas.
- Usa `pnpm` en lugar de `npm`.

## Main dependencies

- Integration testing `jest`
- E2E testing `playwright`
- Style `tailwind`
- Linter `prettier`
- Analyze code `ESlint`

## Standard security

No hagas lo siguiente:

- hardcodees secretos, tokens o credenciales;
- registres información sensible innecesariamente;
- implementes criptografía manualmente;
- debilites controles de seguridad existentes para simplificar una implementación.

## Relevant commands

| Comando                 | Ejecución                                      | Descripción                                                                                                                                                    |
| ----------------------- | ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run ng`            | `ng`                                           | Ejecuta directamente la CLI de Angular. Permite pasar comandos adicionales de Angular después de `--`.                                                         |
| `npm start`             | `ng serve`                                     | Inicia el servidor de desarrollo de Angular y sirve la aplicación localmente.                                                                                  |
| `npm run build`         | `ng build`                                     | Compila la aplicación Angular y genera los archivos de distribución para despliegue.                                                                           |
| `npm run watch`         | `ng build --watch --configuration development` | Compila la aplicación en modo desarrollo y permanece observando cambios para recompilar automáticamente.                                                       |
| `npm test`              | `jest`                                         | Ejecuta la suite de pruebas utilizando Jest.                                                                                                                   |
| `npm run test:watch`    | `jest --watch`                                 | Ejecuta Jest en modo observación, volviendo a ejecutar las pruebas cuando detecta cambios en los archivos.                                                     |
| `npm run test:ci`       | `jest --runInBand --coverage`                  | Ejecuta todas las pruebas secuencialmente y genera el reporte de cobertura. Está orientado principalmente a pipelines de CI/CD.                                |
| `npm run lint`          | `ng lint`                                      | Ejecuta el análisis estático del código para detectar problemas de estilo, calidad o reglas de lint configuradas en el proyecto.                               |
| `pnpm run test:e2e`     | `playwright test`                              | Ejecuta la suite end-to-end con Playwright sobre Firefox. Requiere haber generado los fixtures.                                                                |
| `pnpm run e2e:fixtures` | `node e2e/fixtures/generate-fixtures.mjs`      | Genera los archivos PDF de prueba usados por la suite end-to-end.                                                                                              |
| `npm run prepare`       | `husky`                                        | Inicializa/configura Husky para habilitar los Git hooks definidos en el proyecto. Normalmente se ejecuta automáticamente después de instalar las dependencias. |

## Documentation

@docs
