import { Router } from "express";
import { z } from "zod";
import { collectionNames, db, getById, now, serializeDocs, setDoc } from "../firestore.js";
import { authenticate } from "../middleware/auth.js";
import { logAction } from "../services/audit.service.js";
import { createModuleBillingEvent } from "../services/billing.service.js";
import { asyncHandler, HttpError, requireUser } from "../utils/http.js";

export const moduleRouter = Router();
moduleRouter.use(authenticate);

const availableModules = [
  { key: "patients", name: "Pacientes", description: "Cadastro, busca e perfil de pacientes.", category: "CLINICAL", basePrice: 0, scope: "COMMON", specialtyKey: null, specialtyName: null },
  { key: "appointments", name: "Agenda", description: "Consultas, filtros e status de atendimento.", category: "ADMINISTRATIVE", basePrice: 0, scope: "COMMON", specialtyKey: null, specialtyName: null },
  { key: "records", name: "Prontuario", description: "Prontuario odontologico basico e historico clinico.", category: "CLINICAL", basePrice: 0, scope: "COMMON", specialtyKey: null, specialtyName: null },
  { key: "documents", name: "Documentos", description: "Upload logico de documentos e imagens.", category: "ADMINISTRATIVE", basePrice: 39.9, scope: "COMMON", specialtyKey: null, specialtyName: null },
  { key: "ai-basic", name: "IA Basica", description: "Mensagens e resumos simples com consumo medido.", category: "AI", basePrice: 79.9, scope: "COMMON", specialtyKey: null, specialtyName: null },
  { key: "ai-advanced", name: "IA Avancada", description: "Relatorios mais detalhados e contexto ampliado.", category: "AI", basePrice: 149.9, scope: "COMMON", specialtyKey: null, specialtyName: null },
  { key: "billing", name: "Cobranca", description: "Estimativa mensal por modulos e consumo.", category: "FINANCIAL", basePrice: 0, scope: "COMMON", specialtyKey: null, specialtyName: null },
  { key: "security-advanced", name: "Seguranca avancada", description: "Base futura para MFA, trilhas e politicas.", category: "SECURITY", basePrice: 49.9, scope: "COMMON", specialtyKey: null, specialtyName: null },
  { key: "exam-images-ai", name: "Radiologia com inteligencia artificial", description: "Upload de imagens odontologicas, deteccao assistida, segmentacao, padroes osseos e apoio diagnostico automatizado.", category: "AI", basePrice: 199.9, scope: "SPECIALTY", specialtyKey: "radiology", specialtyName: "Radiologia odontologica" },
  { key: "radiology-reports", name: "Laudos radiologicos", description: "Base para laudos de radiografias, tomografias e anexos de imagem.", category: "SPECIALTY", basePrice: 129.9, scope: "SPECIALTY", specialtyKey: "radiology", specialtyName: "Radiologia odontologica" },
  { key: "radiology-intraoral", name: "Radiologia convencional intraoral", description: "Periapical, bite-wing, oclusal, diagnostico de carie, avaliacao endodontica e controle periodontal.", category: "SPECIALTY", basePrice: 89.9, scope: "SPECIALTY", specialtyKey: "radiology", specialtyName: "Radiologia odontologica" },
  { key: "radiology-extraoral", name: "Radiologia extraoral", description: "Panoramica, telerradiografia lateral/frontal, ortodontia, cirurgia e avaliacao geral das arcadas.", category: "SPECIALTY", basePrice: 99.9, scope: "SPECIALTY", specialtyKey: "radiology", specialtyName: "Radiologia odontologica" },
  { key: "radiology-cbct", name: "Tomografia computadorizada CBCT", description: "Imagem 3D de alta precisao para implantodontia, cirurgia bucomaxilofacial e endodontia complexa.", category: "SPECIALTY", basePrice: 169.9, scope: "SPECIALTY", specialtyKey: "radiology", specialtyName: "Radiologia odontologica" },
  { key: "radiology-surgical-planning", name: "Radiologia para planejamento cirurgico", description: "Planejamento de implantes, estruturas anatomicas, trajetos cirurgicos e procedimentos complexos.", category: "SPECIALTY", basePrice: 149.9, scope: "SPECIALTY", specialtyKey: "radiology", specialtyName: "Radiologia odontologica" },
  { key: "radiology-digital-imaging", name: "Imaginologia digital", description: "Radiografia digital, armazenamento eletronico, processamento e organizacao de imagem.", category: "SPECIALTY", basePrice: 119.9, scope: "SPECIALTY", specialtyKey: "radiology", specialtyName: "Radiologia odontologica" },
  { key: "radiology-diagnostic-imaging", name: "Diagnostico por imagem", description: "Interpretacao de alteracoes osseas, identificacao de lesoes e diagnostico diferencial.", category: "SPECIALTY", basePrice: 139.9, scope: "SPECIALTY", specialtyKey: "radiology", specialtyName: "Radiologia odontologica" },
  { key: "radiology-oral-pathology", name: "Radiologia para patologias bucais", description: "Cistos, tumores, infeccoes osseas e apoio diagnostico de patologias bucais.", category: "SPECIALTY", basePrice: 149.9, scope: "SPECIALTY", specialtyKey: "radiology", specialtyName: "Radiologia odontologica" },
  { key: "radiology-orthodontic", name: "Radiologia ortodontica", description: "Analise cefalometrica, planejamento ortodontico e avaliacao de crescimento.", category: "SPECIALTY", basePrice: 119.9, scope: "SPECIALTY", specialtyKey: "radiology", specialtyName: "Radiologia odontologica" },
  { key: "radiology-endodontic", name: "Radiologia endodontica", description: "Avaliacao de canais, controle de tratamento e diagnostico de lesoes periapicais.", category: "SPECIALTY", basePrice: 129.9, scope: "SPECIALTY", specialtyKey: "radiology", specialtyName: "Radiologia odontologica" },
  { key: "radiology-implantology", name: "Radiologia para implantodontia", description: "Volume osseo, planejamento de implantes, densidade ossea e estruturas anatomicas.", category: "SPECIALTY", basePrice: 149.9, scope: "SPECIALTY", specialtyKey: "radiology", specialtyName: "Radiologia odontologica" },
  { key: "endodontics-planning", name: "Planejamento endodontico", description: "Ficha base para diagnostico, plano endodontico, canais, testes, achados e acompanhamento.", category: "SPECIALTY", basePrice: 89.9, scope: "SPECIALTY", specialtyKey: "endodontics", specialtyName: "Endodontia" },
  { key: "endodontics-conventional", name: "Endodontia clinica convencional", description: "Tratamento de canal, retratamento, controle de infeccoes pulpares e diagnostico de dor endodontica.", category: "SPECIALTY", basePrice: 79.9, scope: "SPECIALTY", specialtyKey: "endodontics", specialtyName: "Endodontia" },
  { key: "endodontics-microscopic", name: "Endodontia microscopica", description: "Microscopio operatorio para canais calcificados, instrumentos fraturados e anatomias complexas.", category: "SPECIALTY", basePrice: 129.9, scope: "SPECIALTY", specialtyKey: "endodontics", specialtyName: "Endodontia" },
  { key: "endodontics-surgical", name: "Endodontia cirurgica / parendodontica", description: "Apicectomia, curetagem periapical, retrobturacao e manejo de falhas do tratamento convencional.", category: "SPECIALTY", basePrice: 149.9, scope: "SPECIALTY", specialtyKey: "endodontics", specialtyName: "Endodontia" },
  { key: "endodontics-regenerative", name: "Endodontia regenerativa", description: "Regeneracao tecidual e manejo de dentes imaturos com necrose pulpar e raiz incompleta.", category: "SPECIALTY", basePrice: 159.9, scope: "SPECIALTY", specialtyKey: "endodontics", specialtyName: "Endodontia" },
  { key: "endodontics-vital", name: "Endodontia biologica / vital", description: "Preservacao da polpa viva, capeamentos pulpares, pulpotomia e tratamentos conservadores.", category: "SPECIALTY", basePrice: 99.9, scope: "SPECIALTY", specialtyKey: "endodontics", specialtyName: "Endodontia" },
  { key: "endodontics-advanced-diagnosis", name: "Diagnostico endodontico avancado", description: "Testes de vitalidade, interpretacao de dor e correlacao com radiografia ou CBCT.", category: "SPECIALTY", basePrice: 119.9, scope: "SPECIALTY", specialtyKey: "endodontics", specialtyName: "Endodontia" },
  { key: "endodontics-microbiology", name: "Microbiologia endodontica", description: "Biofilmes, bacterias dos canais radiculares, infeccao persistente e resistencia microbiana.", category: "SPECIALTY", basePrice: 109.9, scope: "SPECIALTY", specialtyKey: "endodontics", specialtyName: "Endodontia" },
  { key: "endodontics-technology", name: "Endodontia tecnologica", description: "Instrumentacao rotatoria/reciprocante, localizadores apicais e sistemas avancados de irrigacao.", category: "SPECIALTY", basePrice: 119.9, scope: "SPECIALTY", specialtyKey: "endodontics", specialtyName: "Endodontia" },
  { key: "orthodontics-planning", name: "Planejamento ortodontico", description: "Base para documentacao ortodontica, objetivos, acompanhamento e contexto geral do caso.", category: "SPECIALTY", basePrice: 119.9, scope: "SPECIALTY", specialtyKey: "orthodontics", specialtyName: "Ortodontia" },
  { key: "orthodontics-preventive", name: "Ortodontia preventiva", description: "Identificacao de habitos deleterios, orientacao de crescimento e intervencoes simples para evitar mas oclusoes.", category: "SPECIALTY", basePrice: 79.9, scope: "SPECIALTY", specialtyKey: "orthodontics", specialtyName: "Ortodontia" },
  { key: "orthodontics-interceptive", name: "Ortodontia interceptiva", description: "Correcao de alteracoes iniciais, aparelhos removiveis e controle do crescimento em criancas e pre-adolescentes.", category: "SPECIALTY", basePrice: 99.9, scope: "SPECIALTY", specialtyKey: "orthodontics", specialtyName: "Ortodontia" },
  { key: "orthodontics-corrective", name: "Ortodontia corretiva", description: "Aparelhos fixos, alinhamento dentario completo, correcao de oclusao e casos simples a complexos.", category: "SPECIALTY", basePrice: 119.9, scope: "SPECIALTY", specialtyKey: "orthodontics", specialtyName: "Ortodontia" },
  { key: "orthodontics-functional-orthopedics", name: "Ortopedia funcional dos maxilares", description: "Modificacao do crescimento facial, aparelhos ortopedicos e intervencoes em idade de crescimento.", category: "SPECIALTY", basePrice: 129.9, scope: "SPECIALTY", specialtyKey: "orthodontics", specialtyName: "Ortodontia" },
  { key: "orthodontics-aesthetic", name: "Ortodontia estetica", description: "Aparelhos esteticos, ceramica, safira, linguais e alinhadores transparentes.", category: "SPECIALTY", basePrice: 139.9, scope: "SPECIALTY", specialtyKey: "orthodontics", specialtyName: "Ortodontia" },
  { key: "orthodontics-digital", name: "Ortodontia digital", description: "Escaneamento intraoral, planejamento digital, simulacao de tratamento e impressao 3D.", category: "SPECIALTY", basePrice: 149.9, scope: "SPECIALTY", specialtyKey: "orthodontics", specialtyName: "Ortodontia" },
  { key: "orthodontics-aligners", name: "Ortodontia com alinhadores", description: "Clear aligners, aparelhos removiveis transparentes e planejamento totalmente digital.", category: "SPECIALTY", basePrice: 159.9, scope: "SPECIALTY", specialtyKey: "orthodontics", specialtyName: "Ortodontia" },
  { key: "orthodontics-surgical", name: "Ortodontia cirurgica", description: "Tratamento combinado com cirurgia ortognatica e correcao de discrepancias esqueleticas severas.", category: "SPECIALTY", basePrice: 179.9, scope: "SPECIALTY", specialtyKey: "orthodontics", specialtyName: "Ortodontia" },
  { key: "orthodontics-lingual", name: "Ortodontia lingual", description: "Aparelhos na face interna dos dentes, com foco em tratamento invisivel externamente.", category: "SPECIALTY", basePrice: 169.9, scope: "SPECIALTY", specialtyKey: "orthodontics", specialtyName: "Ortodontia" },
  { key: "orthodontics-myofunctional", name: "Ortodontia funcional miofuncional", description: "Reeducacao muscular e correcao de funcoes como degluticao, respiracao e postura oral.", category: "SPECIALTY", basePrice: 119.9, scope: "SPECIALTY", specialtyKey: "orthodontics", specialtyName: "Ortodontia" },
  { key: "orthodontics-biological-personalized", name: "Ortodontia biologica / personalizada", description: "Tratamentos individualizados, respeito a biologia do paciente e minimizacao de danos.", category: "SPECIALTY", basePrice: 139.9, scope: "SPECIALTY", specialtyKey: "orthodontics", specialtyName: "Ortodontia" },
  { key: "orthodontics-ai", name: "Ortodontia com inteligencia artificial", description: "Predicao de movimento dentario, planejamento automatico, simulacao de resultados e ajustes dinamicos.", category: "SPECIALTY", basePrice: 189.9, scope: "SPECIALTY", specialtyKey: "orthodontics", specialtyName: "Ortodontia" },
  { key: "implantology-planning", name: "Planejamento de implantes", description: "Base para planejamento cirurgico-protetico, avaliacao de risco e checklist de implantes.", category: "SPECIALTY", basePrice: 149.9, scope: "SPECIALTY", specialtyKey: "implantology", specialtyName: "Implantodontia" },
  { key: "implantology-surgical", name: "Implantodontia cirurgica", description: "Instalacao de implantes, acesso osseo, volume/densidade ossea, implantes unitarios, multiplos e imediatos.", category: "SPECIALTY", basePrice: 139.9, scope: "SPECIALTY", specialtyKey: "implantology", specialtyName: "Implantodontia" },
  { key: "implantology-prosthetic", name: "Implantodontia protetica", description: "Reabilitacao sobre implantes, coroas, proteses fixas, protocolo, ajustes oclusais e estetica funcional.", category: "SPECIALTY", basePrice: 129.9, scope: "SPECIALTY", specialtyKey: "implantology", specialtyName: "Implantodontia" },
  { key: "implantology-bone-regeneration", name: "Implantodontia com regeneracao ossea", description: "Enxertos osseos, regeneracao ossea guiada, biomateriais e preparo de leito para implantes.", category: "SPECIALTY", basePrice: 159.9, scope: "SPECIALTY", specialtyKey: "implantology", specialtyName: "Implantodontia" },
  { key: "implantology-advanced-surgeries", name: "Implantodontia com cirurgias avancadas", description: "Sinus lift, expansao ossea, split crest e cirurgias reconstrutivas.", category: "SPECIALTY", basePrice: 179.9, scope: "SPECIALTY", specialtyKey: "implantology", specialtyName: "Implantodontia" },
  { key: "implantology-immediate", name: "Implantodontia imediata", description: "Implante no momento da extracao, estabilidade primaria, reducao de tempo e planejamento preciso.", category: "SPECIALTY", basePrice: 149.9, scope: "SPECIALTY", specialtyKey: "implantology", specialtyName: "Implantodontia" },
  { key: "implantology-guided", name: "Implantodontia guiada", description: "Planejamento digital com CBCT/software, guias cirurgicos e execucao minimamente invasiva.", category: "SPECIALTY", basePrice: 169.9, scope: "SPECIALTY", specialtyKey: "implantology", specialtyName: "Implantodontia" },
  { key: "implantology-aesthetic", name: "Implantodontia estetica", description: "Regiao anterior, contorno gengival, harmonia facial e perfil de emergencia.", category: "SPECIALTY", basePrice: 149.9, scope: "SPECIALTY", specialtyKey: "implantology", specialtyName: "Implantodontia" },
  { key: "implantology-peri-implant", name: "Implantodontia peri-implantar", description: "Peri-implantite, mucosite peri-implantar, manutencao preventiva e complicacoes.", category: "SPECIALTY", basePrice: 119.9, scope: "SPECIALTY", specialtyKey: "implantology", specialtyName: "Implantodontia" },
  { key: "implantology-biomaterials", name: "Implantodontia biomateriais e superficies", description: "Tipos de implantes, tratamentos de superficie, biomateriais e osseointegracao.", category: "SPECIALTY", basePrice: 109.9, scope: "SPECIALTY", specialtyKey: "implantology", specialtyName: "Implantodontia" },
  { key: "implantology-digital-ai", name: "Implantodontia digital / inteligente", description: "Planejamento digital completo, simulacao, integracao com IA e predicao de sucesso do implante.", category: "SPECIALTY", basePrice: 189.9, scope: "SPECIALTY", specialtyKey: "implantology", specialtyName: "Implantodontia" },
  { key: "periodontics-chart", name: "Periodontograma", description: "Sondagem, mobilidade, recessao, sangramento e acompanhamento periodontal estruturado.", category: "SPECIALTY", basePrice: 99.9, scope: "SPECIALTY", specialtyKey: "periodontics", specialtyName: "Periodontia" },
  { key: "periodontics-preventive", name: "Periodontia preventiva", description: "Controle de placa, profilaxia, orientacao de higiene oral e acompanhamento periodico.", category: "SPECIALTY", basePrice: 69.9, scope: "SPECIALTY", specialtyKey: "periodontics", specialtyName: "Periodontia" },
  { key: "periodontics-clinical", name: "Periodontia clinica", description: "Gengivite, periodontite, raspagem, alisamento radicular e controle de infeccao.", category: "SPECIALTY", basePrice: 109.9, scope: "SPECIALTY", specialtyKey: "periodontics", specialtyName: "Periodontia" },
  { key: "periodontics-surgical", name: "Periodontia cirurgica", description: "Cirurgia de acesso, retalho, reducao de bolsa periodontal e casos avancados.", category: "SPECIALTY", basePrice: 139.9, scope: "SPECIALTY", specialtyKey: "periodontics", specialtyName: "Periodontia" },
  { key: "periodontics-regeneration", name: "Regeneracao periodontal", description: "ROG, RTG, biomateriais e recuperacao de estruturas periodontais perdidas.", category: "SPECIALTY", basePrice: 159.9, scope: "SPECIALTY", specialtyKey: "periodontics", specialtyName: "Periodontia" },
  { key: "periodontics-aesthetic", name: "Periodontia estetica", description: "Cirurgia plastica periodontal, gengivoplastia, gengivectomia, recobrimento radicular e sorriso gengival.", category: "SPECIALTY", basePrice: 139.9, scope: "SPECIALTY", specialtyKey: "periodontics", specialtyName: "Periodontia" },
  { key: "periodontics-perio-implant", name: "Interface perio-implante", description: "Preparacao gengival para implantes, manutencao peri-implantar e tratamento de peri-implantite.", category: "SPECIALTY", basePrice: 149.9, scope: "SPECIALTY", specialtyKey: "periodontics", specialtyName: "Periodontia" },
  { key: "periodontics-systemic", name: "Periodontia sistemica", description: "Relacao entre doenca periodontal, diabetes, doencas cardiovasculares, gravidez e inflamacao sistemica.", category: "SPECIALTY", basePrice: 129.9, scope: "SPECIALTY", specialtyKey: "periodontics", specialtyName: "Periodontia" },
  { key: "periodontics-microbiology-immunology", name: "Microbiologia e imunologia periodontal", description: "Biofilme, resposta inflamatoria e interacao hospedeiro-microrganismo com impacto clinico.", category: "SPECIALTY", basePrice: 119.9, scope: "SPECIALTY", specialtyKey: "periodontics", specialtyName: "Periodontia" },
  { key: "periodontics-special-patients", name: "Periodontia para pacientes especiais", description: "Pacientes sistemicos, imunocomprometidos, idosos e pessoas com deficiencia.", category: "SPECIALTY", basePrice: 139.9, scope: "SPECIALTY", specialtyKey: "periodontics", specialtyName: "Periodontia" },
  { key: "periodontics-maintenance", name: "Periodontia de manutencao", description: "Suporte periodontal, acompanhamento continuo, controle de recidiva e manutencao da saude periodontal.", category: "SPECIALTY", basePrice: 99.9, scope: "SPECIALTY", specialtyKey: "periodontics", specialtyName: "Periodontia" },
  { key: "periodontics-digital-ai", name: "Periodontia digital / IA", description: "Monitoramento gengival por imagem, deteccao precoce de inflamacao, risco periodontal e acompanhamento remoto.", category: "SPECIALTY", basePrice: 169.9, scope: "SPECIALTY", specialtyKey: "periodontics", specialtyName: "Periodontia" },
  { key: "pediatric-dentistry", name: "Odontologia para bebes", description: "Atendimento desde os primeiros meses, orientacao aos pais, aleitamento, higiene inicial e habitos.", category: "SPECIALTY", basePrice: 79.9, scope: "SPECIALTY", specialtyKey: "pediatric", specialtyName: "Odontopediatria" },
  { key: "pediatric-preventive", name: "Odontopediatria preventiva", description: "Fluor, selantes, educacao em saude bucal, controle de dieta e prevencao precoce.", category: "SPECIALTY", basePrice: 69.9, scope: "SPECIALTY", specialtyKey: "pediatric", specialtyName: "Odontopediatria" },
  { key: "pediatric-restorative", name: "Dentistica em odontopediatria", description: "Restauracoes infantis, materiais especificos e tratamento de carie em criancas.", category: "SPECIALTY", basePrice: 89.9, scope: "SPECIALTY", specialtyKey: "pediatric", specialtyName: "Odontopediatria" },
  { key: "pediatric-behavior", name: "Manejo comportamental infantil", description: "Condicionamento psicologico, controle de ansiedade, comunicacao adaptada e sedacao consciente quando indicada.", category: "SPECIALTY", basePrice: 119.9, scope: "SPECIALTY", specialtyKey: "pediatric", specialtyName: "Odontopediatria" },
  { key: "pediatric-deciduous-endo", name: "Endodontia em dentes deciduos", description: "Pulpotomia, pulpectomia e controle de infeccoes em dentes de leite.", category: "SPECIALTY", basePrice: 99.9, scope: "SPECIALTY", specialtyKey: "pediatric", specialtyName: "Odontopediatria" },
  { key: "pediatric-interceptive", name: "Odontopediatria interceptiva", description: "Ortopedia funcional, correcao de habitos bucais e intervencoes precoces de crescimento.", category: "SPECIALTY", basePrice: 109.9, scope: "SPECIALTY", specialtyKey: "pediatric", specialtyName: "Odontopediatria" },
  { key: "pediatric-trauma", name: "Traumatologia dentaria infantil", description: "Fraturas, avulsoes, luxacoes e acompanhamento de trauma dentario em criancas.", category: "SPECIALTY", basePrice: 119.9, scope: "SPECIALTY", specialtyKey: "pediatric", specialtyName: "Odontopediatria" },
  { key: "pediatric-hospital", name: "Odontologia hospitalar pediatrica", description: "Atendimento infantil complexo, necessidades especiais, anestesia geral e condicoes sistemicas.", category: "SPECIALTY", basePrice: 149.9, scope: "SPECIALTY", specialtyKey: "pediatric", specialtyName: "Odontopediatria" },
  { key: "pediatric-special-needs", name: "Pacientes infantis com necessidades especiais", description: "Autismo, sindromes geneticas, deficiencias motoras ou cognitivas e adaptacao de atendimento.", category: "SPECIALTY", basePrice: 139.9, scope: "SPECIALTY", specialtyKey: "pediatric", specialtyName: "Odontopediatria" },
  { key: "pediatric-cariology", name: "Cariologia infantil", description: "Progressao da carie, fatores de risco, estrategias de controle e acompanhamento preventivo.", category: "SPECIALTY", basePrice: 99.9, scope: "SPECIALTY", specialtyKey: "pediatric", specialtyName: "Odontopediatria" },
  { key: "pediatric-digital-ai", name: "Odontopediatria digital / IA", description: "Monitoramento remoto de higiene, educacao gamificada, orientacao aos pais e predicao de risco de carie.", category: "SPECIALTY", basePrice: 159.9, scope: "SPECIALTY", specialtyKey: "pediatric", specialtyName: "Odontopediatria" },
  { key: "aesthetic-dentistry", name: "Planejamento estetico", description: "Base para planejamento estetico, fotografias, mockups, objetivos do sorriso e acompanhamento.", category: "SPECIALTY", basePrice: 109.9, scope: "SPECIALTY", specialtyKey: "aesthetics", specialtyName: "Odontologia estetica" },
  { key: "aesthetic-restorative", name: "Dentistica estetica restauradora", description: "Resinas compostas, reconstrucoes, fechamento de diastemas, naturalidade, funcao e forma dental.", category: "SPECIALTY", basePrice: 99.9, scope: "SPECIALTY", specialtyKey: "aesthetics", specialtyName: "Odontologia estetica" },
  { key: "aesthetic-whitening", name: "Clareamento dental", description: "Clareamento de consultorio, caseiro supervisionado e interno em dentes tratados endodonticamente.", category: "SPECIALTY", basePrice: 69.9, scope: "SPECIALTY", specialtyKey: "aesthetics", specialtyName: "Odontologia estetica" },
  { key: "aesthetic-veneers", name: "Lentes de contato dentais e facetas", description: "Facetas de resina, facetas de porcelana, lentes ultrafinas, forma, cor e alinhamento visual.", category: "SPECIALTY", basePrice: 139.9, scope: "SPECIALTY", specialtyKey: "aesthetics", specialtyName: "Odontologia estetica" },
  { key: "aesthetic-reanatomization", name: "Reanatomizacao dental", description: "Modelagem estetica, alteracao de formato dental e harmonizacao do sorriso com minimo desgaste.", category: "SPECIALTY", basePrice: 89.9, scope: "SPECIALTY", specialtyKey: "aesthetics", specialtyName: "Odontologia estetica" },
  { key: "aesthetic-dsd", name: "Planejamento estetico digital / DSD", description: "Digital Smile Design, simulacao do sorriso, planejamento com fotos, softwares e suporte de IA.", category: "SPECIALTY", basePrice: 149.9, scope: "SPECIALTY", specialtyKey: "aesthetics", specialtyName: "Odontologia estetica" },
  { key: "aesthetic-gingival", name: "Estetica gengival", description: "Gengivoplastia, gengivectomia, correcao de sorriso gengival e harmonia dos tecidos moles.", category: "SPECIALTY", basePrice: 119.9, scope: "SPECIALTY", specialtyKey: "aesthetics", specialtyName: "Odontologia estetica" },
  { key: "aesthetic-biomimetic", name: "Odontologia biomimetica", description: "Restauracoes que imitam a estrutura natural e preservam ao maximo o tecido dental.", category: "SPECIALTY", basePrice: 129.9, scope: "SPECIALTY", specialtyKey: "aesthetics", specialtyName: "Odontologia estetica" },
  { key: "aesthetic-prosthetic", name: "Estetica com proteses dentarias", description: "Coroas esteticas, proteses fixas e reabilitacao oral estetica integrada.", category: "SPECIALTY", basePrice: 139.9, scope: "SPECIALTY", specialtyKey: "aesthetics", specialtyName: "Odontologia estetica" },
  { key: "aesthetic-materials", name: "Materiais esteticos avancados", description: "Ceramicas odontologicas, resinas de alta performance e sistemas CAD/CAM.", category: "SPECIALTY", basePrice: 109.9, scope: "SPECIALTY", specialtyKey: "aesthetics", specialtyName: "Odontologia estetica" },
  { key: "aesthetic-digital-ai", name: "Odontologia estetica digital / IA", description: "Simulacao estetica com IA, previsao de resultado, analise de sorriso e sugestao de tratamento.", category: "SPECIALTY", basePrice: 179.9, scope: "SPECIALTY", specialtyKey: "aesthetics", specialtyName: "Odontologia estetica" }
] as const;

async function ensureAvailableModules() {
  await Promise.all(
    availableModules.map((module) =>
      setDoc(collectionNames.modules, module.key, {
        ...module,
        isActive: true,
        updatedAt: now()
      })
    )
  );
}

moduleRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const user = requireUser(req);
    await ensureAvailableModules();
    const [modulesSnapshot, clinicModulesSnapshot] = await Promise.all([
      db().collection(collectionNames.modules).where("isActive", "==", true).get(),
      db().collection(collectionNames.clinicModules).where("clinicId", "==", user.clinicId).get()
    ]);
    const clinicModules = serializeDocs<Record<string, unknown>>(clinicModulesSnapshot);
    const modules = serializeDocs<Record<string, unknown>>(modulesSnapshot).sort((a, b) => {
      const scopeA = String(a.scope ?? "COMMON");
      const scopeB = String(b.scope ?? "COMMON");
      return `${scopeA}${a.specialtyName ?? ""}${a.category ?? ""}${a.name ?? ""}`.localeCompare(
        `${scopeB}${b.specialtyName ?? ""}${b.category ?? ""}${b.name ?? ""}`
      );
    });
    res.json(
      modules.map((module) => ({
        ...module,
        enabled: clinicModules.find((item) => item.moduleId === module.id)?.enabled ?? false,
        clinicModuleId: clinicModules.find((item) => item.moduleId === module.id)?.id
      }))
    );
  })
);

moduleRouter.patch(
  "/:moduleId",
  asyncHandler(async (req, res) => {
    const user = requireUser(req);
    const moduleId = String(req.params.moduleId);
    const { enabled } = z.object({ enabled: z.boolean() }).parse(req.body);
    const module = await getById<Record<string, unknown>>(collectionNames.modules, moduleId);
    if (!module) throw new HttpError(404, "Modulo nao encontrado.");
    const previous = await getById<Record<string, unknown>>(collectionNames.clinicModules, `${user.clinicId}_${module.id}`);
    const clinicModule = await setDoc(collectionNames.clinicModules, `${user.clinicId}_${module.id}`, {
      clinicId: user.clinicId,
      moduleId: module.id,
      enabled,
      activatedAt: enabled ? now() : null,
      deactivatedAt: enabled ? null : now()
    });
    await logAction({
      clinicId: user.clinicId,
      userId: user.id,
      action: enabled ? "ENABLE_MODULE" : "DISABLE_MODULE",
      entity: "Module",
      entityId: module.id
    });
    if (previous?.enabled !== enabled) {
      await createModuleBillingEvent({
        clinicId: user.clinicId,
        moduleId: String(module.id),
        moduleName: String(module.name ?? module.key ?? module.id),
        enabled,
        monthlyPrice: Number(module.basePrice ?? 0)
      });
    }
    res.json(clinicModule);
  })
);
