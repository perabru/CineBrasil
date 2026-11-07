CREATE DATABASE IF NOT EXISTS cinebrasil
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE cinebrasil;

CREATE TABLE IF NOT EXISTS usuarios (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  nome VARCHAR(80) NOT NULL,
  email VARCHAR(190) NOT NULL UNIQUE,
  senha_hash VARCHAR(255) NOT NULL,
  papel ENUM('usuario', 'admin') NOT NULL DEFAULT 'usuario',
  criado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS filmes (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  titulo VARCHAR(160) NOT NULL,
  ano SMALLINT UNSIGNED NOT NULL,
  genero VARCHAR(80) NOT NULL,
  duracao_min SMALLINT UNSIGNED NOT NULL,
  sinopse TEXT NOT NULL,
  capa_url VARCHAR(700) NULL,
  trailer_url VARCHAR(700) NULL,
  criado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS favoritos (
  usuario_id INT UNSIGNED NOT NULL,
  filme_id INT UNSIGNED NOT NULL,
  criado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (usuario_id, filme_id),
  CONSTRAINT fk_fav_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
  CONSTRAINT fk_fav_filme FOREIGN KEY (filme_id) REFERENCES filmes(id) ON DELETE CASCADE
);

-- IMPORTANTE: depois de criar sua conta no site, transforme-a em admin usando
-- UPDATE usuarios SET papel = 'admin' WHERE email = 'SEU_EMAIL_AQUI';
-- Execute o comando acima no phpMyAdmin, substituindo pelo seu e-mail.
