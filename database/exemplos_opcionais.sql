-- OPCIONAL: importe apenas se quiser alguns filmes para testar o catalogo.
-- As capas estao vazias de proposito; voce pode fornecer seus proprios links depois.
USE cinebrasil;
INSERT INTO filmes (titulo, ano, genero, duracao_min, sinopse, capa_url, trailer_url) VALUES
('Central do Brasil', 1998, 'Drama', 113, 'Uma mulher que escreve cartas em uma estacao ferroviaria acompanha um menino em uma viagem pelo Brasil.', NULL, NULL),
('O Auto da Compadecida', 2000, 'Comédia', 104, 'Dois amigos tentam sobreviver usando esperteza no sertao nordestino.', NULL, NULL),
('Cidade de Deus', 2002, 'Drama', 130, 'Um jovem fotografo observa mudancas na comunidade onde cresceu, no Rio de Janeiro.', NULL, NULL),
('Que Horas Ela Volta?', 2015, 'Drama', 112, 'A chegada de uma estudante altera a rotina e as relacoes em uma casa de Sao Paulo.', NULL, NULL);
