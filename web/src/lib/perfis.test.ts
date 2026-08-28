import { describe, expect, it } from 'vitest';
import { PERFIS, opcoesDeCaptura } from './perfis';

describe('opcoesDeCaptura', () => {
  it('usa 720p e 15fps com hint de detalhe no perfil tela', () => {
    const { captura, publicacao } = opcoesDeCaptura(PERFIS.tela, false, 'vp9');
    expect(captura.resolution).toEqual({ width: 1280, height: 720, frameRate: 15 });
    expect(captura.contentHint).toBe('detail');
    expect(captura.audio).toBe(true);
    expect(publicacao.simulcast).toBe(false);
    expect(publicacao.videoCodec).toBe('vp9');
  });

  it('usa 30fps com hint de movimento no perfil vídeo', () => {
    const { captura } = opcoesDeCaptura(PERFIS.video, false, 'vp9');
    expect(captura.resolution?.frameRate).toBe(30);
    expect(captura.contentHint).toBe('motion');
  });

  it('dobra resolução e bitrate na opção de alta qualidade', () => {
    const padrao = opcoesDeCaptura(PERFIS.video, false, 'vp9');
    const alta = opcoesDeCaptura(PERFIS.video, true, 'vp9');
    expect(alta.captura.resolution).toEqual({ width: 1920, height: 1080, frameRate: 30 });
    expect(alta.publicacao.videoEncoding!.maxBitrate).toBe(
      padrao.publicacao.videoEncoding!.maxBitrate * 2,
    );
  });
});
