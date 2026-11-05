import type { Migration } from '../database.types.js';

export const createForum: Migration = {
  version: 3,
  name: 'create-forum',
  sql: `
    CREATE TABLE forum_topics (
      id VARCHAR(32) PRIMARY KEY,
      name VARCHAR(80) NOT NULL,
      description VARCHAR(240) NOT NULL,
      position INTEGER NOT NULL
    );
    INSERT INTO forum_topics(id,name,description,position) VALUES
      ('general','General','Ideas, preguntas y conversaciones de todos los días.',1),
      ('tecnologia','Tecnología','Herramientas, descubrimientos y lo que cambia a nuestro alrededor.',2),
      ('aprendizaje','Aprendizaje','Preguntas, recursos y cosas que estamos aprendiendo.',3),
      ('creatividad','Creatividad','Procesos, inspiración e ideas que toman forma.',4),
      ('proyectos','Proyectos','Lo que estás construyendo y lo que aprendes en el camino.',5);
    CREATE TABLE forum_posts (
      id BIGSERIAL PRIMARY KEY,
      topic_id VARCHAR(32) NOT NULL REFERENCES forum_topics(id),
      author_id UUID NOT NULL REFERENCES users(id),
      title VARCHAR(160) NOT NULL CHECK (char_length(title) > 0),
      body VARCHAR(10000) NOT NULL CHECK (char_length(body) > 0),
      request_id UUID NOT NULL,
      reply_count INTEGER NOT NULL DEFAULT 0 CHECK (reply_count >= 0),
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      last_activity_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(author_id,request_id)
    );
    CREATE INDEX forum_posts_topic_page ON forum_posts(topic_id,id DESC);
    CREATE INDEX forum_posts_author_page ON forum_posts(author_id,id DESC);
    CREATE TABLE forum_replies (
      id BIGSERIAL PRIMARY KEY,
      post_id BIGINT NOT NULL REFERENCES forum_posts(id),
      author_id UUID NOT NULL REFERENCES users(id),
      body VARCHAR(5000) NOT NULL CHECK (char_length(body) > 0),
      request_id UUID NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(author_id,request_id)
    );
    CREATE INDEX forum_replies_page ON forum_replies(post_id,id DESC);
    ALTER TABLE auth_google_flows ADD COLUMN return_to VARCHAR(256) NOT NULL DEFAULT '/';
  `,
};
