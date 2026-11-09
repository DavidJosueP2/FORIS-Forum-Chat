import { createHash } from 'node:crypto';
import type { ForumCategory } from '@messages/contracts';

interface Branch { slug: string; name: string; description?: string; children?: Branch[] }
const leaf = (slug: string, name: string): Branch => ({ slug, name });

// Slugs locales a su rama; el UUID estable depende de la ruta completa.
const tree: Branch[] = [
  { slug: 'general', name: 'General', description: 'Ideas, preguntas y conversaciones de todos los días.', children: [
    { slug: 'sociedad', name: 'Sociedad y cultura', children: [leaf('actualidad', 'Actualidad'), leaf('historia', 'Historia'), leaf('filosofia', 'Filosofía'), leaf('culturas', 'Culturas y tradiciones')] },
    { slug: 'vida-cotidiana', name: 'Vida cotidiana', children: [leaf('gastronomia', 'Gastronomía'), leaf('viajes', 'Viajes y lugares'), leaf('bienestar', 'Bienestar'), leaf('mascotas', 'Mascotas')] },
    { slug: 'aficiones', name: 'Aficiones', children: [leaf('videojuegos', 'Videojuegos'), leaf('deportes', 'Deportes'), leaf('lectura', 'Lectura'), leaf('coleccionismo', 'Coleccionismo')] },
  ] },
  { slug: 'tecnologia', name: 'Tecnología', description: 'Herramientas, descubrimientos y lo que cambia a nuestro alrededor.', children: [
    { slug: 'desarrollo', name: 'Desarrollo de software', children: [
      { slug: 'web', name: 'Desarrollo web', children: [leaf('frontend', 'Frontend'), leaf('backend', 'Backend'), leaf('accesibilidad', 'Accesibilidad web')] },
      leaf('movil', 'Aplicaciones móviles'), leaf('lenguajes', 'Lenguajes de programación'), leaf('arquitectura', 'Arquitectura de software'), leaf('calidad', 'Calidad y pruebas'),
    ] },
    { slug: 'datos', name: 'Datos e inteligencia artificial', children: [leaf('bases-de-datos', 'Bases de datos'), leaf('analisis', 'Análisis de datos'), leaf('aprendizaje-automatico', 'Aprendizaje automático'), leaf('ia-generativa', 'IA generativa')] },
    { slug: 'infraestructura', name: 'Infraestructura y seguridad', children: [leaf('nube', 'Computación en la nube'), leaf('redes', 'Redes'), leaf('ciberseguridad', 'Ciberseguridad'), leaf('sistemas', 'Sistemas operativos')] },
    { slug: 'hardware', name: 'Hardware y electrónica', children: [leaf('computadoras', 'Computadoras'), leaf('robotica', 'Robótica'), leaf('electronica', 'Electrónica')] },
  ] },
  { slug: 'aprendizaje', name: 'Aprendizaje', description: 'Preguntas, recursos y cosas que estamos aprendiendo.', children: [
    { slug: 'ciencias', name: 'Ciencias', children: [leaf('matematicas', 'Matemáticas'), leaf('fisica', 'Física'), leaf('biologia', 'Biología'), leaf('astronomia', 'Astronomía')] },
    { slug: 'humanidades', name: 'Humanidades', children: [leaf('idiomas', 'Idiomas'), leaf('literatura', 'Literatura'), leaf('ciencias-sociales', 'Ciencias sociales')] },
    { slug: 'estudio', name: 'Estudiar y enseñar', children: [leaf('metodos', 'Métodos de estudio'), leaf('recursos', 'Recursos educativos'), leaf('docencia', 'Docencia'), leaf('universidad', 'Vida universitaria')] },
    { slug: 'profesional', name: 'Desarrollo profesional', children: [leaf('carreras', 'Carreras y orientación'), leaf('entrevistas', 'Entrevistas'), leaf('habilidades', 'Habilidades profesionales')] },
  ] },
  { slug: 'creatividad', name: 'Creatividad', description: 'Procesos, inspiración e ideas que toman forma.', children: [
    { slug: 'diseno', name: 'Diseño', children: [leaf('grafico', 'Diseño gráfico'), leaf('interfaces', 'Interfaces y experiencia'), leaf('producto', 'Diseño de producto'), leaf('tipografia', 'Tipografía')] },
    { slug: 'artes-visuales', name: 'Artes visuales', children: [leaf('ilustracion', 'Ilustración'), leaf('fotografia', 'Fotografía'), leaf('animacion', 'Animación'), leaf('arte-digital', 'Arte digital')] },
    { slug: 'narrativa', name: 'Escritura y narrativa', children: [leaf('ficcion', 'Ficción'), leaf('poesia', 'Poesía'), leaf('guion', 'Guion')] },
    { slug: 'sonido', name: 'Música y sonido', children: [leaf('composicion', 'Composición'), leaf('produccion', 'Producción musical'), leaf('instrumentos', 'Instrumentos')] },
  ] },
  { slug: 'proyectos', name: 'Proyectos', description: 'Lo que estás construyendo y lo que aprendes en el camino.', children: [
    { slug: 'construir', name: 'Crear y construir', children: [leaf('software', 'Proyectos de software'), leaf('fisicos', 'Objetos y fabricación'), leaf('artisticos', 'Proyectos artísticos')] },
    { slug: 'emprendimiento', name: 'Emprendimiento', children: [leaf('ideas', 'Ideas de negocio'), leaf('validacion', 'Validación de ideas'), leaf('lanzamientos', 'Lanzamientos')] },
    { slug: 'colaboracion', name: 'Colaboración', children: [leaf('codigo-abierto', 'Código abierto'), leaf('equipos', 'Buscar colaboradores'), leaf('iniciativas', 'Iniciativas comunitarias')] },
    { slug: 'proceso', name: 'Compartir el proceso', children: [leaf('avances', 'Avances'), leaf('feedback', 'Pedir opiniones'), leaf('aprendizajes', 'Aprendizajes del proyecto')] },
  ] },
];

function stableId(path: string): string {
  const bytes = createHash('sha256').update('foris:catalog:v1:' + path).digest().subarray(0, 16);
  bytes[6] = (bytes[6]! & 15) | 128; // UUID versión 8, espacio de nombres propio del catálogo.
  bytes[8] = (bytes[8]! & 63) | 128;
  const hex = bytes.toString('hex');
  return [hex.slice(0, 8), hex.slice(8, 12), hex.slice(12, 16), hex.slice(16, 20), hex.slice(20)].join('-');
}
function flatten(branches: Branch[], parents: string[] = [], slugs: string[] = []): ForumCategory[] {
  return branches.flatMap((branch, position) => {
    const route = [...slugs, branch.slug];
    const id = stableId(route.join('/'));
    const path = [...parents, id];
    return [{ id, slug: branch.slug, name: branch.name, description: branch.description ?? '',
      parentId: parents.at(-1) ?? null, rootId: path[0]!, depth: parents.length, path, position },
    ...flatten(branch.children ?? [], path, route)];
  });
}
export const forumCatalog: readonly ForumCategory[] = flatten(tree);
export const forumSeedTags = ['pregunta', 'guía', 'debate', 'recurso', 'inspiración', 'feedback', 'tutorial', 'experiencia', 'descubrimiento', 'colaboración'];
export const forumSeedTagRows = forumSeedTags.map(name => ({ id: stableId('tag/' + name), name }));
const literal = (value: string) => "'" + value.replaceAll("'", "''") + "'";
export const forumCatalogSql = `
  INSERT INTO forum_categories(id,slug,name,description,parent_id,root_id,depth,path,position) VALUES
  ${forumCatalog.map(item => '(' + [literal(item.id), literal(item.slug), literal(item.name), literal(item.description),
    item.parentId ? literal(item.parentId) : 'NULL', literal(item.rootId), item.depth,
    'ARRAY[' + item.path.map(literal).join(',') + ']::uuid[]', item.position].join(',') + ')').join(',\n')};
  INSERT INTO forum_tags(id,name,is_seeded) VALUES
  ${forumSeedTagRows.map(({ id, name }) => '(' + literal(id) + ',' + literal(name) + ',TRUE)').join(',\n')};
`;
